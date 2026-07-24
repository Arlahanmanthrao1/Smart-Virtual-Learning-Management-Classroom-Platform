lms-platform/
│
├── backend/                          # "Backend / API layer" box — ✅ already built
│   ├── app/
│   │   ├── main.py                   # wires up the FastAPI app
│   │   ├── config.py                 # env-based settings (🆕 add ERP_BASE_URL)
│   │   ├── database.py               # SQLAlchemy engine/session (→ PostgreSQL box)
│   │   │
│   │   ├── models/                   # DB tables
│   │   │   ├── user.py
│   │   │   ├── course.py
│   │   │   ├── attendance.py
│   │   │   ├── assignment.py
│   │   │   └── quiz.py
│   │   │
│   │   ├── schemas/                  # request/response validation
│   │   ├── core/                     # security.py, deps.py (auth + role checks)
│   │   │
│   │   ├── routers/                  # ── maps to the 4 purple modules ──
│   │   │   ├── auth.py               #   Authentication
│   │   │   ├── users.py              #   Authentication
│   │   │   ├── courses.py            #   LMS core
│   │   │   ├── assignments.py        #   LMS core
│   │   │   ├── quiz.py               #   LMS core
│   │   │   ├── attendance.py         #   Video & attendance (🆕 calls erp_client after marking attendance)
│   │   │   └── ai.py                 #   AI services  (add in Phase 2)
│   │   │
│   │   ├── services/                 # business logic, kept out of routers
│   │   │   ├── attendance_calc.py    #   real join/leave duration math
│   │   │   ├── transcription.py      #   Whisper wrapper        ┐
│   │   │   ├── summarization.py      #   LLM prompt calls        ├─ AI services
│   │   │   ├── plagiarism.py         #   sentence-transformers   │
│   │   │   └── at_risk.py            #   rules-based flagging   ┘
│   │   │
│   │   └── integrations/             # ── "External APIs" box ──
│   │       ├── jitsi_client.py       #   room creation, event parsing
│   │       ├── whisper_client.py     #   speech-to-text calls
│   │       ├── llm_client.py         #   summaries & insights
│   │       └── erp_client.py         # 🆕 pushes attendance updates to the college ERP
│   │
│   ├── storage/                      # "File storage" box (local dev stand-in for S3)
│   │   ├── recordings/
│   │   └── documents/
│   │
│   ├── requirements.txt              # (🆕 add httpx, for the ERP sync call)
│   ├── .env.example
│   └── README.md
│
├── erp-dummy/                        # 🆕 separate "existing college ERP" service
│   ├── app/
│   │   ├── main.py                   #   FastAPI app - sync endpoint + dashboard
│   │   ├── database.py               #   its own SQLite DB (separate from LMS)
│   │   ├── models.py                 #   Student (pre-seeded), AttendanceRecord
│   │   ├── schemas.py                #   AttendanceSyncIn
│   │   └── templates/
│   │       └── dashboard.html        #   simple live-updating attendance view
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                         # "Web client (React)" box — not built yet
│   ├── public/
│   ├── src/
│   │   ├── api/                      # axios wrappers calling the backend
│   │   ├── context/                  # auth context, role-based routing
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── classroom/            # Jitsi embed + IFrame event listeners
│   │   │   └── lms/                  # quiz/assignment UI
│   │   ├── pages/
│   │   │   ├── student/
│   │   │   ├── faculty/
│   │   │   ├── hod/
│   │   │   └── admin/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
│
├── docs/
│   ├── architecture-diagram.png
│   ├── db-schema.md
│   └── api-reference.md
│
├── docker-compose.yml                # optional: postgres + backend + erp-dummy + frontend together
└── README.md                         # top-level project overview