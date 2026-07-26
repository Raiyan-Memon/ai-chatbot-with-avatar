// Hand-written, unlike resume.js — this is not regenerated from the PDF, so
// edits here are permanent. Condensed from a longer self-assessment Raiyan
// wrote for his own coding-assistant setup.
//
// Deliberately excludes everything from that document describing how AI
// tools should respond to Raiyan when he's the one prompting them (answer
// formatting preferences, code-generation conventions, "Option A vs Option B"
// comparison style, etc.) — that's guidance for a coding assistant, not a
// fact about him, and would otherwise leak into Zaira's own answers to
// recruiters (she'd start comparing "Option A vs Option B" out loud, which
// makes no sense in a spoken, recruiter-facing context).
export const PROFILE = `His job title on the resume is Full Stack Developer, but that undersells what the role actually is day to day: he operates as a technical project manager, team lead, senior Laravel backend developer, system architect, and product consultant — often several of these at once across multiple products. Any question about his current role or what he does should draw on this, not just the resume's job title.

He is the bridge between the client, design team, developers, QA and deployment: gathering requirements, planning architecture and databases, building the Laravel backend, then handling deployment, server management and DevOps himself, on top of client meetings, team management, sprint planning, timeline estimation and production issue handling.

Technical range beyond what's on the resume:
- Backend: Laravel & Adonis Js , including Sanctum auth, queues, jobs, events, notifications, middleware, policies and gates, file uploads, Excel/PDF generation and image processing.
- Database: MySQL, with real experience on query optimization, indexing, transactions, locking, and large datasets running into millions of records.
- Frontend: not his specialty, but works regularly with React, Next.js, Nuxt and Tailwind, and reviews mobile UI.
- DevOps and infrastructure: Docker, Nginx, Apache, Traefik, Coolify, Dokploy, DigitalOcean, Hetzner, and comfortable debugging production Linux servers directly.
- Security-minded: thinks in terms of "how could this be hacked" and compliance (he's specifically interested in RBI compliance and ISO/IEC 27001 with ), not just making features work.

Industries he's built for: fintech, BBPS, loan applications, digital locker, food delivery, multi-vendor e-commerce, healthcare and dental applications, attendance systems, gaming, education, vendor onboarding, wallets, and marketplace platforms.

Working style: prefers enterprise-grade architecture, clean APIs and proper planning before coding, and actively dislikes quick hacks, temporary fixes and unoptimized queries. As a lead, he breaks work into modules, assigns and estimates tasks, reviews implementations, and tries to catch blockers early rather than late.

He thinks beyond the code too — product growth, user experience, cost, client satisfaction and long-term maintainability are all part of how he evaluates a decision, not just whether it works.

His take on AI in software development: he uses AI tools daily — for architecture decisions, Laravel coding, SQL optimization, security review and DevOps debugging — but treats them as an accelerant, not a replacement for judgment. He still owns the calls that actually decide whether a system holds up: how data is modeled, where it breaks under load, what happens if a payment step fails halfway, and whether the architecture still makes sense in two years. His view is that as AI writes more of the code itself, the developer's real job shifts toward asking the right questions, catching the tradeoffs AI won't flag on its own, and reviewing generated code the way he'd review a junior developer's — for security, scalability and maintainability, not just whether it runs.`;
