# Lista de la compra

[![CI](https://github.com/Criscode2022/listacompra/actions/workflows/ci.yml/badge.svg)](https://github.com/Criscode2022/listacompra/actions/workflows/ci.yml)

Aplicación de lista de la compra desarrollada con Angular + Ionic, preparada para ejecutarse como:

- PWA (web instalable con Service Worker)
- Aplicación Android (vía Capacitor)

El proyecto está orientado a una experiencia sencilla y rápida para gestionar productos de compra con almacenamiento local persistente, filtros por categoría y exportación en PDF.

## Tabla de contenidos

- [Visión general](#visión-general)
- [Funcionalidades](#funcionalidades)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura y flujo de datos](#arquitectura-y-flujo-de-datos)
- [Modelo de datos](#modelo-de-datos)
- [Requisitos previos](#requisitos-previos)
- [Instalación y puesta en marcha](#instalación-y-puesta-en-marcha)
- [Scripts disponibles](#scripts-disponibles)
- [Ejecución como app Android](#ejecución-como-app-android)
- [Compilación y despliegue](#compilación-y-despliegue)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Calidad y pruebas](#calidad-y-pruebas)
- [Testing](#testing)
- [Posibles mejoras futuras](#posibles-mejoras-futuras)

## Visión general

Esta aplicación permite mantener una lista de productos con tres vistas principales:

- Despensa: inventario general y gestión de productos.
- Lista: productos pendientes para comprar y opción de exportar en PDF.
- Urgente: productos de prioridad alta separados del resto.

La interfaz se apoya en el modelo de tabs de Ionic, mientras que el estado global de productos se maneja con Signals de Angular para actualizar la UI en tiempo real.

## Funcionalidades

### Gestión de productos

- Alta de productos mediante modal.
- Edición de cantidad con validación.
- Marcado/desmarcado de estado comprado.
- Eliminación de productos.
- Limpieza completa del almacenamiento local.

### Categorización y unidades

- Categorías predefinidas (frutas, verduras, carnes, pescados, lácteos, panadería, bebidas, limpieza, higiene, congelados y otros).
- Unidades de medida (ud, kg, g, l, ml, oz, lb).
- Filtros por categoría con contador dinámico por vista.

### Vista urgente

- Gestión separada de productos urgentes.
- Creación de productos urgentes desde modal dedicado.

### Exportación

- Exportación de la lista pendiente a PDF.
- Documento agrupado por categoría, con fecha y formato preparado para impresión.

### Persistencia y compatibilidad

- Almacenamiento local con Ionic Storage (IndexedDB en navegador).
- Migración automática de datos antiguos sin unidad/categoría para mantener compatibilidad con versiones previas.

## Stack tecnológico

- Angular 17
- Ionic 7
- Capacitor 5
- Ionic Storage
- Angular Signals
- RxJS
- Angular Material (snackbars)
- Tailwind CSS
- jsPDF (generación de PDF)

## Arquitectura y flujo de datos

La lógica principal vive en un servicio central de datos:

- DataService
  - Inicializa y conecta Ionic Storage.
  - Expone el estado global products como signal.
  - Persiste cambios automáticamente en almacenamiento local.
  - Aplica migraciones de datos en el arranque.

### Flujo de actualización

1. El usuario crea/edita/elimina un producto desde una pantalla.
2. La pantalla actualiza el signal de productos.
3. Angular re-renderiza automáticamente las vistas afectadas.
4. Un effect del servicio persiste la nueva lista en Ionic Storage.

Este enfoque evita sincronizaciones manuales complejas y mantiene UI + estado + persistencia alineados.

## Modelo de datos

Cada producto sigue esta estructura:

```ts
interface Product {
  name: string;
  checked: boolean;
  quantity: number;
  urgent: boolean;
  unit: "ud" | "kg" | "g" | "l" | "ml" | "oz" | "lb";
  category: "frutas" | "verduras" | "carnes" | "pescados" | "lácteos" | "panadería" | "bebidas" | "limpieza" | "higiene" | "congelados" | "otros";
}
```

## Requisitos previos

- Node.js LTS (recomendado 18 o superior)
- npm (incluido con Node.js)
- Angular CLI (opcional, para comandos directos)
- Ionic CLI (opcional)

Para Android además:

- Android Studio
- SDK de Android configurado
- Java JDK compatible con Android Studio

## Instalación y puesta en marcha

1. Instalar dependencias:

```bash
npm install
```

2. Ejecutar entorno de desarrollo web:

```bash
npm start
```

3. Abrir en navegador:

- URL habitual: http://localhost:4200

## Scripts disponibles

```bash
npm start   # servidor de desarrollo
npm run build   # build de producción
npm run watch   # build en modo watch (development)
npm test    # pruebas unitarias con Karma/Jasmine
npm run test:watch   # ejecución en watch mode
npm run test:ci   # ejecución única en ChromeHeadless
npm run test:coverage   # ejecución con cobertura
npm run lint    # análisis estático con ESLint
```

## Ejecución como app Android

Si todavía no existe la plataforma Android en el proyecto:

```bash
npx cap add android
```

Flujo habitual para generar y abrir Android:

```bash
npm run build
npx cap sync android
npx cap open android
```

Notas:

- El build web se genera en la carpeta www (webDir de Capacitor).
- Tras cambios en frontend, vuelve a ejecutar build + cap sync.

## Compilación y despliegue

### Build de producción

```bash
npm run build
```

Salida en:

- www/

### Despliegue en Netlify

El proyecto incluye configuración en netlify.toml:

- Comando de build: npm run build
- Carpeta publicada: www
- Redirección SPA a index.html para rutas de Angular

## Estructura del proyecto

```text
src/
	app/
		core/
			services/        # servicios de negocio (DataService)
			directives/      # directivas reutilizables
			types/           # tipos y modelos
		layout/
			header/          # cabecera compartida
			add-product-modal/
		tabs/
			tab-pantry/      # vista despensa
			tab-list/        # vista lista + export PDF
			tab-urgent/      # vista urgente
	assets/
	theme/
www/                   # build web listo para despliegue
```

## Calidad y pruebas

- Pruebas unitarias: Jasmine + Karma.
- Linting: ESLint con reglas de Angular.

## Testing

La aplicación incluye tests unitarios para componentes, directivas y servicios.

### Cobertura actual

- Componentes de app y tabs.
- Directivas reutilizables.
- Servicio de datos con persistencia local (migración, borrado y almacenamiento).

### Ejecución local

```bash
npm test
```

### Ejecución para CI

```bash
npm run test:ci
```

### Generar reporte de cobertura

```bash
npm run test:coverage
```

El informe de cobertura se genera en:

- coverage/app/index.html

### Pipeline recomendada

```bash
npm run lint
npm run test:ci
npm run build
```
