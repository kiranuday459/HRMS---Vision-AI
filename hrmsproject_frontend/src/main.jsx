import React from 'react';
import ReactDom from "react-dom/client";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom';
import "@fortawesome/fontawesome-free/css/all.min.css";
import './index.css'
import App from './App.jsx'

// Global fetch interceptor to automatically route localhost API calls to the dynamic k3s API URL
const originalFetch = window.fetch;
window.fetch = async function(url, options) {
    if (typeof url === 'string' && url.includes('http://localhost:8080')) {
        const hostname = window.location.hostname;
        const replaceDomain = (hostname === 'localhost' || hostname === '127.0.0.1') 
            ? "http://localhost:8080" 
            : ""; // Use relative path in production
        url = url.replace('http://localhost:8080', replaceDomain);
    }
    // Also support Request objects if passing them
    return originalFetch.apply(this, arguments);
};

createRoot(document.getElementById('root')).render(

    <BrowserRouter>
    {/* <StrictMode> */}
    <App />
    {/* </StrictMode> */}
    </BrowserRouter>
,
)

