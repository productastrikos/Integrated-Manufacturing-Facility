# Integrated Manufacturing Facility

A modern **Industry 4.0 Manufacturing Operations Console** designed to provide a unified view of factory operations, production performance, equipment health, materials, quality, safety, and operational intelligence.

The application combines **real-time operational monitoring, KPI visualization, alerts, work allocation, equipment intelligence, and Digital Twin concepts** into a single manufacturing command-center interface.

---

## Overview

The Integrated Manufacturing Facility dashboard is designed as a centralized operational platform for monitoring and managing a modern manufacturing facility.

The system provides visibility across the complete operational lifecycle:

**Procurement → Receiving → Production → Quality & Inspection → Packaging → Shipping & Dispatch → Installation & Commissioning**

The interface is structured to help plant operators, supervisors, engineers, and management quickly understand the current state of the facility and respond to operational issues.

---

## Key Capabilities

### Manufacturing Operations

* Production performance monitoring
* Production output and targets
* Throughput monitoring
* Schedule adherence
* Line utilization
* Cycle-time monitoring
* Downtime tracking
* Overall Equipment Effectiveness (OEE)
* Availability, Performance, and Quality monitoring

### Equipment & Asset Monitoring

* Equipment health monitoring
* Machine status
* Equipment utilization
* Downtime identification
* Maintenance-related alerts
* Operational condition monitoring
* Asset-level performance visibility

### Materials & Inventory

* Raw material availability
* Inventory status
* Material consumption
* Low-stock identification
* Procurement requirements
* Material movement through the facility
* Material allocation and availability monitoring

### Quality & Inspection

* In-process quality monitoring
* Inspection status
* Quality deviations
* Non-conformance tracking
* Final inspection
* Quality-related alerts
* Production quality trends

### Safety & Security

* Safety monitoring
* Operational alerts
* Security events
* Exception monitoring
* Critical incident visibility

### Energy & Facility Monitoring

* Energy performance
* Facility-level operational monitoring
* Building management information
* Resource utilization
* Operational efficiency indicators

---

## Digital Twin

The application incorporates a **Digital Twin-oriented factory architecture** to represent the physical manufacturing facility digitally.

The facility is organized into physical operational zones rather than treating each function as an isolated dashboard.

### Factory Flow

```text
Main Gate
    ↓
Receiving
    ↓
Raw Material Storage
    ↓
Production
    ↓
Quality & Inspection
    ↓
Packaging
    ↓
Finished Goods Warehouse
    ↓
Dispatch
    ↓
Outbound Gate
```

### Digital Twin Workstreams

#### Procurement

* Main Material Gate
* Truck Check-in
* Receiving Dock
* Incoming Inspection
* Raw Material Storage
* Material Issue / Kitting

#### Manufacturing

* Production Building
* Production Lines
* Conveyors
* Machines
* Work-in-Progress Storage
* Control Room
* Operator Areas

#### Quality & Inspection

* In-process Inspection
* QC Laboratory
* Measurement and Testing
* Final Inspection
* Non-Conformance Area

#### Shipping & Dispatch

* Finished Goods Warehouse
* Dispatch Staging
* Loading Bays
* Outbound Trucks
* Outbound Gate

#### Installation & Commissioning

* Equipment Installation Zone
* Commissioning / Testing Area
* Utility Connections
* FAT / SAT Area

#### Construction & Capital Works

* Expansion Zone
* Active Construction
* Equipment Foundations
* Structural / MEP Work
* Future Production Areas

---

## Operations Dashboard

The main Operations Console provides a high-level view of the manufacturing facility.

Typical operational KPIs include:

| KPI                | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| OEE                | Overall equipment effectiveness                                |
| Availability       | Percentage of scheduled production time equipment is available |
| Performance        | Actual production performance against expected speed           |
| Quality            | Percentage of output meeting quality requirements              |
| Throughput         | Production volume over time                                    |
| Production Output  | Current production quantity                                    |
| Target Achievement | Progress against production targets                            |
| Schedule Adherence | Production completed according to schedule                     |
| Line Utilization   | Usage of available production capacity                         |
| Downtime           | Equipment and production downtime                              |
| Cycle Time         | Time required to complete a production cycle                   |

---

## Operational Intelligence

The dashboard includes an operational intelligence layer designed to convert factory data into actionable information.

Examples include:

* Performance deviations
* Equipment exceptions
* Production delays
* Material shortages
* Quality deviations
* Safety alerts
* Maintenance concerns
* Operational recommendations

Alerts can be connected to operational workflows so that identified issues can be assigned to designated personnel.

---

## Work Allocation

The system includes an operational work allocation concept for managing issues identified within the facility.

A concern can be associated with:

* Issue / concern
* Factory area
* Equipment or station
* Priority
* Assigned employee
* Employee availability
* Required action
* Status
* Due time
* Resolution information

This provides a path from:

```text
Detection
    ↓
Alert
    ↓
Work Assignment
    ↓
Corrective Action
    ↓
Resolution
```

---

## Visualization

The dashboard uses multiple visualization techniques to communicate manufacturing performance.

Examples include:

* KPI cards
* Trend charts
* Production charts
* Utilization charts
* OEE breakdowns
* Status indicators
* Equipment health indicators
* Alert panels
* Operational tables
* Progress indicators
* Factory/Digital Twin views
* Real-time status visualization

The objective is to prioritize **fast operational understanding** rather than presenting raw data without context.

---

## Technology Stack

### Frontend

* React
* TypeScript
* Vite
* HTML5
* CSS
* Modern component-based UI architecture

### Development

* Node.js
* npm
* Git
* GitHub

### Visualization

The application uses interactive dashboard visualizations to represent production, equipment, inventory, quality, and operational performance.

---

## Project Structure

```text
Integrated-Manufacturing-Facility/
│
├── public/
│   └── Static assets
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── assets/
│   ├── data/
│   └── application logic
│
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Getting Started

### Prerequisites

Make sure the following are installed:

* Node.js
* npm
* Git

### Installation

Clone the repository:

```bash
git clone https://github.com/productastrikos/Integrated-Manufacturing-Facility.git
```

Navigate into the project:

```bash
cd Integrated-Manufacturing-Facility
```

Install dependencies:

```bash
npm install
```

### Run Development Server

Start the application:

```bash
npm run dev
```

The application will normally be available at:

```text
http://localhost:5192
```

For access from other devices on the same network:

```bash
npm run dev -- --host 0.0.0.0
```

---

## Production Build

Create a production build:

```bash
npm run build
```

The optimized application will be generated in:

```text
dist/
```

---

## Application Routes

The application contains operational views accessible through application routes.

Example:

```text
/app/login
/app/overview
```

Additional operational modules can be added as the manufacturing platform expands.

---

## Development Approach

The application is designed around a modular dashboard architecture so that individual manufacturing capabilities can evolve independently while remaining part of a unified operations platform.

The architecture is intended to support future integration with:

* Industrial IoT sensors
* PLC / SCADA systems
* MES platforms
* ERP systems
* Maintenance systems
* Inventory systems
* Quality systems
* Digital Twin models
* Real-time event streams
* AI-based operational recommendations

---

## Future Enhancements

Potential future extensions include:

* Live IoT sensor integration
* Real-time equipment telemetry
* Three-dimensional Digital Twin visualization
* Predictive maintenance
* AI-based production optimization
* Automated anomaly detection
* Live inventory synchronization
* Automated procurement recommendations
* Advanced quality analytics
* Energy optimization
* Production scheduling optimization
* Role-based access control
* Historical operational analytics
* Database integration
* WebSocket-based real-time updates

---

## Purpose

The Integrated Manufacturing Facility project demonstrates how a modern manufacturing environment can be represented through a unified digital operations platform.

The goal is to provide a **single operational view of the factory**, connecting production, equipment, materials, quality, safety, facility operations, alerts, and Digital Twin concepts into one intelligent manufacturing interface.
---
