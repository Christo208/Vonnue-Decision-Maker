```mermaid
---
config:
  layout: fixed
---
flowchart LR
 subgraph CLIENT["CLIENT"]
    direction TB
        Browser["Browser (HTML / CSS / JS)"]
        Manual["Manual Compare"]
        Smart["Smart Compare"]
        Memory["Memory History"]
  end
 subgraph ROUTES["API ROUTES"]
    direction TB
        Preprocess["POST /api/preprocess"]
        Calculate["POST /api/calculate"]
        Refine["POST /api/refine-query"]
        Search["POST /api/search"]
        Scrape["POST /api/scrape"]
        MemoryRoutes["Memory CRUD Routes"]
  end
 subgraph SERVICES["CORE SERVICES"]
    direction TB
        Decision["decisionLogic.js"]
        MemoryService["memoryService.js"]
        Scrapers["Scraper Modules"]
  end
 subgraph SERVER["SERVER - Node.js + Express"]
    direction TB
        Express["Express App :3000"]
        ROUTES
        SERVICES
  end
 subgraph DATA["DATA"]
    direction TB
        Firebase["Firebase Firestore"]
        MemoryFallback["In-Memory Fallback"]
  end
 subgraph EXTERNAL["EXTERNAL APIs"]
    direction TB
        Groq["Groq API"]
        Gemini["Gemini API"]
        Reliance["Reliance API"]
        Croma["Croma Scraping"]
  end
 subgraph DEPLOY["DEPLOYMENT"]
    direction TB
        GitHub["GitHub"]
        Railway["Railway"]
  end
    Browser --> Manual & Smart & Memory
    Express --> ROUTES
    ROUTES --> SERVICES
    Manual --> Preprocess & Calculate
    Smart --> Refine & Search & Scrape
    Memory --> MemoryRoutes
    Preprocess L_Preprocess_Decision_0@--> Decision
    Calculate --> Decision
    MemoryRoutes --> MemoryService
    Decision --> Groq & Gemini
    Scrape --> Scrapers & Groq
    Search --> Reliance
    MemoryService --> Firebase & MemoryFallback
    GitHub --> Railway
    Railway --> Express

     Browser:::node
     Manual:::node
     Smart:::node
     Memory:::node
     Preprocess:::node
     Calculate:::node
     Refine:::node
     Search:::node
     Scrape:::node
     MemoryRoutes:::node
     Decision:::node
     MemoryService:::node
     Scrapers:::node
     Express:::node
     Firebase:::node
     MemoryFallback:::node
     Groq:::node
     Gemini:::node
     Reliance:::node
     Croma:::node
     GitHub:::node
     Railway:::node
    classDef layer fill:#111827,color:#ffffff,stroke:#374151,stroke-width:2px
    classDef node fill:#1f2937,color:#ffffff,stroke:#4b5563

    L_Preprocess_Decision_0@{ curve: natural }