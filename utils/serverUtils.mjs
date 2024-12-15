// module: serverUtils
// Description: This module contains utility functions for working with server instances.
// Last Modified: 2024-12-15

import axios from 'axios';
const INTERVAL = 4 * 60 * 1000; // 4 minutes
/**
 * Retrieves all available routes from the given application.
 * 
 * @param {Object} app - The application instance from which to extract routes.
 * @returns {Array} An array of objects, each containing the path and methods of a route.
 */
export function getAvailableRoutes(app) {
    const routes = [];
    app._router.stack.forEach((middleware) => {
        if (middleware.route) {
            // Routes registered directly on the app
            routes.push(middleware.route);
        } else if (middleware.name === 'router') {
            // Routes added as router middleware
            middleware.handle.stack.forEach((handler) => {
                const route = handler.route;
                route && routes.push(route);
            });
        }
    });
    return routes.map((route) => ({
        path: route.path,
        methods: Object.keys(route.methods).join(', ').toUpperCase(),
    }));
}

/**
 * keepAlive - Periodically sends a GET request to the /ping route to keep the server awake.
 * 
 * This function sets up an interval that sends a GET request every 5 minutes (300,000 milliseconds)
 * to the specified server endpoint. If the request fails, an error message is logged to the console.
 * 
 * @function
 */
export const keepAlive = () => {
    setInterval(async () => {
        try {
            await axios.get('https://pocketdiary-server.onrender.com/ping');
            await axios.get('https://pocketdiary-server.onrender.com/pingDB');
            console.warn('Ping successful at:' + new Date().toLocaleString());

        } catch (error) {
            console.error('Ping failed:', error.message);
        }
    }, INTERVAL);
};
