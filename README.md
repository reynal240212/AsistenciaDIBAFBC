# DIBA FBC - Sistema de Asistencia por Reconocimiento Facial ⚽️🏢

![DIBA FBC Banner](https://img.shields.io/badge/DIBA_FBC-Official_System-blue?style=for-the-badge&logo=soccer&logoColor=yellow)
![Version](https://img.shields.io/badge/Version-2.4.1-gold?style=for-the-badge)

Sistema profesional de control de asistencia para el club **DIBA FBC**, utilizando inteligencia artificial para el reconocimiento facial de jugadores de todas las categorías.

## ✨ Características Principales

-   **Reconocimiento Facial IA**: Identificación instantánea con `face-api.js`.
-   **Identidad del Club**: Interfaz personalizada con los colores oficiales Navy (Azul) y Gold (Oro).
-   **Gestión por Categorías**: Organización automática de jugadores por año de nacimiento.
-   **Panel de Configuración Elite**: Ajuste de sensibilidad IA, feedback auditivo y modo espejo.
-   **Registro en Vivo**: Feed en tiempo real de las asistencias marcadas.
-   **Base de Datos en Tiempo Real**: Sincronización completa con Supabase.

## 🛠 Tecnologías Utilizadas

-   **Frontend**: React + Tailwind CSS
-   **IA/ML**: `face-api.js` (TensorFlow.js)
-   **Backend**: Supabase (PostgreSQL + Realtime)
-   **Animaciones**: Framer Motion
-   **Iconos**: Lucide React

## 🚀 Instalación y Uso Local

1.  **Clonar el repositorio**:
    ```bash
    git clone https://github.com/reynal240212/AsistenciaDIBAFBC.git
    cd AsistenciaDIBAFBC
    ```

2.  **Instalar dependencias**:
    ```bash
    npm install
    ```

3.  **Configurar variables de entorno**:
    Crea un archivo `.env` con tus credenciales de Supabase:
    ```env
    VITE_SUPABASE_URL=tu_url
    VITE_SUPABASE_ANON_KEY=tu_key
    ```

4.  **Iniciar servidor de desarrollo**:
    ```bash
    npm run dev
    ```

## 📋 Requisitos de Hardware

-   Cámara web con resolución mínima de 720p.
-   Navegador moderno (Chrome/Edge recomendado) con permisos de cámara activados.

---
*Desarrollado para la excelencia deportiva en DIBA FBC.*
