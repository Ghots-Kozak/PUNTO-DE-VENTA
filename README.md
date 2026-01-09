# PUNTO-DE-VENTA
# DELTA - Punto de Venta Inteligente

**Sistema POS web para tiendas pequeñas y medianas**

## Descripción

DELTA es un sistema de punto de venta desarrollado en Node.js con Express y MySQL, diseñado para gestionar ventas, inventario, clientes y reportes de manera eficiente y segura. Incluye control de acceso por roles (Dueño y Cajero) y funcionalidades en tiempo real como actualización de stock y puntos de fidelidad.

Proyecto realizado para la materia **Gestión de Proyectos de Software**.

## Funcionalidades principales

- Login con roles diferenciados
- Caja de ventas: búsqueda rápida, carrito dinámico, descuento, métodos de pago, cambio y ticket
- Gestión de productos (CRUD) con alerta de stock bajo
- Módulo de clientes con puntos fidelidad (1 punto por cada $10)
- Reportes con resumen y gráficas (ventas diarias, top productos)
- Diseño responsive y usabilidad optimizada

## Tecnologías

- **Frontend**: HTML5, Bootstrap 5, JavaScript, SweetAlert2
- **Backend**: Node.js + Express
- **Base de datos**: MySQL
- **Comunicación**: Fetch API (JSON)

## Instalación

```bash
git clone https://github.com/Ghots-Kozak/PUNTO-DE-VENTA.git
cd PUNTO-DE-VENTA
npm install express mysql2
node server.js
