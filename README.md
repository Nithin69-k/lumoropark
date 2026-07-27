<div align="center">

# 🅿️ LumoroX Park

**Book private driveway parking by the hour — or turn your driveway into income.**

[![Live App](https://img.shields.io/badge/Live%20App-lumoropark.lovable.app-6C5CE7?style=for-the-badge)](https://lumoropark.lovable.app)
[![Built with Lovable](https://img.shields.io/badge/Built%20with-Lovable-FF6B6B?style=for-the-badge)](https://lovable.dev)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](#license)

[Live Demo](https://lumoropark.lovable.app) · [Report Bug](../../issues) · [Request Feature](../../issues)

</div>

---

## 📖 Overview

**LumoroX Park** is a peer-to-peer driveway parking marketplace. Renters find and book private parking spots near them by the hour, while hosts list their empty driveways to earn passive income. The platform is built around three core ideas: **live availability**, **frictionless contactless check-in**, and **two-sided trust**.

> Park smarter. Earn from your driveway.

## ✨ Features

- 🗺️ **Live map** — see free spots update in real time as bookings happen
- 📱 **QR check-in** — contactless arrival, no keys and no phone calls
- ⚡ **EV-ready filtering** — search by chargers, covered spots, and gated lots
- 🛡️ **Trust score** — every host and renter earns a public reliability score
- 🔐 **Auth flows** — dedicated sign-in / sign-up for both renters and hosts
- 🚗 **Two-sided marketplace** — "Find parking near me" for renters, "List your driveway" for hosts

## 🖼️ Preview

<div align="center">

<!-- TODO: replace with real screenshots — drop images in a /docs or /public/screenshots folder and update paths -->
<img src="./docs/screenshot-landing.png" alt="LumoroX Park landing page" width="800"/>

</div>

> 📸 *Add screenshots of the landing page, browse/map view, and booking flow here before publishing.*

## 🧱 Tech Stack

> ⚠️ **Confirm/edit this section to match your actual repo** — inferred from the deployed app (built via [Lovable](https://lovable.dev)); update anything that doesn't match your codebase.

| Layer | Technology |
|---|---|
| Framework | React + Vite |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Routing | React Router |
| Auth / Backend | Supabase *(confirm)* |
| Maps | *(confirm — e.g. Mapbox / Google Maps)* |
| Deployment | Lovable / Vercel |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm/yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/Nithin69-k/lumoropark.git
cd lumoropark

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173` (or the port Vite assigns).

### Environment Variables

Create a `.env` file in the project root:

```env
# TODO: add your actual environment variables
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📂 Project Structure

```
lumoropark/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/           # Route-level pages (landing, browse, auth, etc.)
│   ├── hooks/            # Custom React hooks
│   ├── lib/               # Utilities, API clients
│   └── main.tsx
├── public/
├── package.json
└── README.md
```

> *(Update this to reflect your actual folder structure.)*

## 🗺️ Roadmap

- [ ] Live map integration with real-time spot availability
- [ ] QR-based check-in/check-out flow
- [ ] Host dashboard with earnings & booking analytics
- [ ] In-app trust score & review system
- [ ] Payments integration
- [ ] Mobile app (React Native)

## 🤝 Contributing

Contributions, issues, and feature requests are welcome.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 📬 Contact

**Nithin K**
📧 nithingowda490@gmail.com
🔗 [GitHub](https://github.com/Nithin69-k) · [Portfolio](https://nitixnstech.vercel.app)

---

<div align="center">

</div>
