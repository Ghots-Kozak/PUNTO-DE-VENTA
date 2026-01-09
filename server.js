const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');

const db = require('./db');  // Tu db.js con mysql2/promise

const app = express();

// Middlewares
app.use(express.json());
app.use(express.static(__dirname));  // Sirve todos los archivos HTML

// Ruta principal: login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Ruta login - redirige a inventario
app.post('/auth/login', async (req, res) => {
    try {
        const { correo, contraseña } = req.body;

        if (!correo || !contraseña) {
            return res.json({ success: false, msg: 'Faltan datos' });
        }

        const [rows] = await db.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);

        if (rows.length === 0) {
            return res.json({ success: false, msg: 'Correo no encontrado' });
        }

        const usuario = rows[0];

        // Comparación directa (como tienes ahora)
        if (contraseña !== usuario.contraseña) {
            return res.json({ success: false, msg: 'Contraseña incorrecta' });
        }

        // Registrar en auditoría
        await db.query(
            'INSERT INTO auditoria (id_usuario, accion, descripcion) VALUES (?, ?, ?)',
            [usuario.id_usuario, 'Login', 'Inicio de sesión exitoso']
        );

        res.json({
            success: true,
            nombre: usuario.nombre,
            rol: usuario.rol,
            redirect: 'inventario.html'  // Directo al inventario
        });

    } catch (err) {
        console.error('ERROR EN LOGIN:', err);
        res.status(500).json({ success: false, msg: 'Error del servidor' });
    }
});

// === INVENTARIO (PRODUCTOS) ===
app.get('/api/productos', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM productos ORDER BY nombre');
        res.json({ success: true, productos: rows });
    } catch (err) {
        console.error('ERROR LISTANDO PRODUCTOS:', err);
        res.status(500).json({ success: false });
    }
});

app.post('/api/productos', async (req, res) => {
    try {
        const { codigo_barras, nombre, descripcion, precio_venta, costo, stock, stock_minimo = 10 } = req.body;
        await db.query(
            'INSERT INTO productos (codigo_barras, nombre, descripcion, precio_venta, costo, stock, stock_minimo) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [codigo_barras || null, nombre, descripcion || null, precio_venta, costo, stock, stock_minimo]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('ERROR CREANDO PRODUCTO:', err);
        res.status(500).json({ success: false });
    }
});

app.put('/api/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo_barras, nombre, descripcion, precio_venta, costo, stock, stock_minimo } = req.body;
        await db.query(
            'UPDATE productos SET codigo_barras = ?, nombre = ?, descripcion = ?, precio_venta = ?, costo = ?, stock = ?, stock_minimo = ? WHERE id_producto = ?',
            [codigo_barras || null, nombre, descripcion || null, precio_venta, costo, stock, stock_minimo || 10, id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('ERROR EDITANDO PRODUCTO:', err);
        res.status(500).json({ success: false });
    }
});

app.delete('/api/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM productos WHERE id_producto = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('ERROR ELIMINANDO PRODUCTO:', err);
        res.status(500).json({ success: false });
    }
});

// === VENTAS ===
app.post('/api/ventas', async (req, res) => {
    try {
        const { total, recibido, cambio, metodo, descuento = 0, items, id_cliente = null } = req.body;
        const id_usuario = 1; // Temporal

        const [ventaResult] = await db.query(
            'INSERT INTO ventas (id_usuario, id_cliente, total, descuento, metodo_pago, recibido, cambio) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id_usuario, id_cliente || null, total, descuento, metodo, recibido, cambio]
        );

        const id_venta = ventaResult.insertId;

        for (const item of items) {
            await db.query(
                'INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
                [id_venta, item.id_producto, item.cantidad, item.precio, item.precio * item.cantidad]
            );

            await db.query(
                'UPDATE productos SET stock = stock - ? WHERE id_producto = ?',
                [item.cantidad, item.id_producto]
            );
        }

        // Puntos (1 por cada $10)
        const puntosGanados = Math.floor(total / 10);
        if (id_cliente && puntosGanados > 0) {
            await db.query('UPDATE clientes SET puntos = puntos + ? WHERE id_cliente = ?', [puntosGanados, id_cliente]);
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// === REPORTES CORREGIDOS ===
app.get('/api/reportes', async (req, res) => {
    let { desde = '2025-01-01', hasta = new Date().toISOString().split('T')[0] } = req.query;

    try {
        // Resumen
        const [resumen] = await db.query(`
            SELECT 
                COALESCE(COUNT(v.id_venta), 0) AS tickets,
                COALESCE(SUM(v.total), 0) AS ventas_total,
                COALESCE(SUM(d.cantidad * (d.precio_unitario - COALESCE(p.costo, 0))), 0) AS ganancias,
                COALESCE(SUM(d.cantidad), 0) AS productos_vendidos
            FROM ventas v
            LEFT JOIN detalle_ventas d ON v.id_venta = d.id_venta
            LEFT JOIN productos p ON d.id_producto = p.id_producto
            WHERE DATE(v.fecha) BETWEEN ? AND ?
        `, [desde, hasta]);

        // Ventas por día
        const [ventasDia] = await db.query(`
            SELECT DATE(v.fecha) AS fecha, COALESCE(SUM(v.total), 0) AS total
            FROM ventas v
            WHERE DATE(v.fecha) BETWEEN ? AND ?
            GROUP BY DATE(v.fecha)
            ORDER BY fecha
        `, [desde, hasta]);

        // Top productos (usando cantidad vendida)
        const [topProductos] = await db.query(`
            SELECT p.nombre, COALESCE(SUM(d.cantidad), 0) AS vendidos
            FROM detalle_ventas d
            JOIN productos p ON d.id_producto = p.id_producto
            JOIN ventas v ON d.id_venta = v.id_venta
            WHERE DATE(v.fecha) BETWEEN ? AND ?
            GROUP BY p.id_producto
            ORDER BY vendidos DESC
            LIMIT 10
        `, [desde, hasta]);

        res.json({
            success: true,
            resumen: resumen[0] || { tickets: 0, ventas_total: 0, ganancias: 0, productos_vendidos: 0 },
            ventasDia,
            topProductos
        });
    } catch (err) {
        console.error('ERROR EN REPORTES:', err);
        res.status(500).json({ success: false, msg: 'Error al cargar reportes' });
    }
});

// === CLIENTES ===
app.get('/api/clientes', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM clientes ORDER BY nombre');
        res.json({ success: true, clientes: rows });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/clientes', async (req, res) => {
    try {
        const { nombre, telefono, correo, puntos = 0 } = req.body;
        await db.query(
            'INSERT INTO clientes (nombre, telefono, correo, puntos) VALUES (?, ?, ?, ?)',
            [nombre, telefono || null, correo || null, puntos]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.put('/api/clientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, telefono, correo, puntos } = req.body;
        await db.query(
            'UPDATE clientes SET nombre = ?, telefono = ?, correo = ?, puntos = ? WHERE id_cliente = ?',
            [nombre, telefono || null, correo || null, puntos, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.delete('/api/clientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM clientes WHERE id_cliente = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log('=====================================');
    console.log('  DELTA POS - SERVIDOR FINAL');
    console.log('  http://localhost:3000');
    console.log('  Todo funcionando: login, inventario, ventas, reportes');
    console.log('=====================================');
});