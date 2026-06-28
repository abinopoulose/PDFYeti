# PDFYeti

**Client-side PDF processing tools. No data leaves your browser.**

[![React](https://img.shields.io/badge/React-19-blue.svg?style=flat-square&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF.svg?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-black.svg?style=flat-square&logo=github)](https://github.com/abinopoulose/PDFYeti)

## Overview

PDFYeti is a web-based utility for managing and processing PDF files. Unlike online PDF tools that require uploading documents to a remote server, PDFYeti performs all operations locally within the browser. This architectural choice guarantees that sensitive personal or financial documents are never transmitted over the network.

## Core Principles

- **Data Privacy:** All document processing is executed locally via JavaScript and WebAssembly. There are no backend servers handling user files and no telemetry collection.
- **Performance:** Local processing eliminates the latency associated with network uploads and downloads. Processing speed is limited only by the host device's hardware capabilities.
- **Usability:** The interface is designed to be straightforward and minimal, focusing strictly on functional utility.

## Features

- **Compress PDF:** Reduces file size using a binary search compression algorithm to balance size and quality.
- **Merge PDF:** Combines multiple PDF files into a single document *(In Development)*.
- **Split PDF:** Extracts pages or page ranges into separate files *(In Development)*.
- **Format Conversion:** Converts PDF pages to JPG images, and JPG images to PDF documents *(In Development)*.
- **Security:** Adds or removes password encryption locally *(In Development)*.

## Technology Stack

- **Framework:** [React 19](https://react.dev/) with TypeScript
- **Build System:** [Vite](https://vitejs.dev/)
- **PDF Processing Libraries:** `pdf-lib`, `jspdf`, `pdfjs-dist`
- **Icons:** [Lucide React](https://lucide.dev/)
