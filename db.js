const mysql = require('mysql2/promise');

const connection = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',  // Cambia por tu contraseña real de MySQL
    database: 'delta_pos',
    port: 3306
});

connection.getConnection()
    .then(() => {
        console.log('=====================================');
        console.log('  DELTA POS - CONEXIÓN EXITOSA A MySQL');
        console.log('  Base de datos: delta_pos');
        console.log('  Usuario: root');
        console.log('  Grupo: 5801 - Tec de Ecatepec');
        console.log('  Proyecto: Punto de Venta DELTA');
        console.log('  Fecha: Diciembre 2025');
        console.log('=====================================');
    })
    .catch(err => {
        console.error('ERROR DE CONEXIÓN:', err);
        process.exit(1);
    });

module.exports = connection;