# Secure Your Soul — Living Product Vision & Experience Blueprint

> **Purpose:** Living reference for the website's identity, narrative, experience, requirements, and development decisions. This file is the quick-to-edit source of truth; the formatted DOCX booklet is the human-readable reference copy.

**Project:** [iYakuza/landing-page](https://github.com/iYakuza/landing-page)  
**Primary site:** https://iyakuza.github.io/landing-page/  
**Version:** 1.0 baseline · 29 October 2026  
**Status:** Living working document. Proposed features are not necessarily implemented.

**Implementation tracker:** See [DEVELOPMENT_TRACKER.md](./DEVELOPMENT_TRACKER.md) for requirement-by-requirement implementation state, verification evidence, and the next task.

## How to maintain this document

When a conversation establishes a durable new decision about the website's identity, story, visual language, information architecture, visitor journeys, community model, Signals, privacy, or requirements:

1. Check this file and the existing decisions first.
2. Add the new decision to the appropriate section; avoid duplicating existing material.
3. If it changes an earlier decision, update the earlier wording and add a short entry to **Decision log**.
4. Mark items as **Decision**, **Proposal**, **Assumption**, or **Open question** so ideas are not mistaken for implemented features.
5. Update the DOCX booklet when a substantial change is made, and keep the repository source and booklet aligned.

This is a standing project-maintenance convention, not an autonomous background process: edits can be made when the assistant is working on the project in a conversation. The assistant cannot monitor every future conversation or change files when no active task/tool execution is occurring.

## 1. Product vision

**Secure Your Soul** is a fictional personality-preservation program presented through a restrained, immersive website. Its public face is an elegant corporate service promising that a person's memories and personality can survive biological death. Beneath that reassuring surface lies a spiritual and existential mystery: does preserving information preserve a person?

**Defining contradiction:** “Arasaka promises that no soul needs to be lost. The archive quietly asks whether a soul can be owned.”

### Experience principles

- **Atmosphere over spectacle:** purposeful motion, tactile textures, restrained color, meaningful negative space.
- **Mystery with structure:** there is more to discover, but navigation remains clear.
- **Humanity over machinery:** art, grief, love, hope, and redemption counterbalance the institution.
- **Choice without exclusion:** Street Kid, Corpo, and Nomad are narrative entry paths, not permission levels.
- **Fiction is clearly framed as fiction:** the real site does not preserve souls or upload personalities.
- **Security, accessibility, privacy, and trust** are part of the product, not optional polish.

## 2. Fictional premise and narrative boundaries

Within the fictional world, Arasaka Corporation operates Secure Your Soul, a personality-preservation program led by Saburo Arasaka. A modified form of Soulkiller creates digital personality constructs stored within Mikoshi infrastructure. The website adopts the voice of a polished institutional portal, while deeper layers question whether a construct is a continuation, copy, prisoner, or something unknown.

### Two layers of truth

- **Official / corporate:** procedure, access, records, classifications, and the preservation promise. Precise, composed, reassuring, controlled.
- **Hidden / interpretive:** contradictions, witness accounts, spiritual questions, and anomalies. Poetic, uncertain, intimate, unsettling.

### Narrative rules

- Never answer every mystery; some records should remain disputed or incomplete.
- Allow institutional, scientific, spiritual, conspiratorial, and personal interpretations to coexist.
- Keep emotional stakes human: memory, identity, grief, consent, love, sacrifice, freedom, and release.
- Use original fictional records and story fragments to build a distinct creative work.
- Distinguish established Cyberpunk universe references from original website lore when useful.
- Do not present fictional preservation as a real service or claim the site can digitize a visitor's personality.

**Core question:** A database can contain information about a person without settling the question of what a person is.

## 3. Theme and symbolic vocabulary

Motifs should tell the story, reveal a belief, or guide the visitor experience—not serve as decoration alone.

| Motif | Meaning / tension | Possible use |
|---|---|---|
| Tarot / Arcana | Fate, choices, temptation, collapse, reconciliation, hope | Section identities, chapter transitions, symbolic case files |
| Shards | Fragments of lives; incomplete evidence | Recovered notes, witness statements, logs, audio/text fragments |
| Murals | Public symbols; hidden messages; art outliving its creator | Visual clues, gallery fragments, narrative discoveries |
| Zen Master / meditation | Stillness, impermanence, suffering, limits of the self | Quiet interludes and reflective pages |
| Mikoshi | Digital afterlife, preservation, ownership, captivity, identity | Archive architecture, construct records, access layers |
| Soulkiller | Transformation of a person into a digital construct | Protocol descriptions and ethical questions |
| Garry the Prophet | Dismissed witness; error overlapping with insight | Unverified reports and contradictory testimony |
| Mr. Blue Eyes | Observer, concealed influence, unknown intelligence | Recurring signature or unexplained archive access |
| Buddhist monks | Liberation, non-attachment, technology versus spiritual freedom | Counter-archive questioning immortality as attachment |
| Braindance / memory | Experience, recording, reconstruction, distortion | Interactive memory fragments and conflicting perspectives |
| Columbarium / memorials | Remembrance without resurrection | Memorial pages and messages to the absent |
| Blackwall / frontier | Boundary around the unknowable | Anomalies, missing records, unexplained signals |
| The Moon / The Star | Hope, escape, intimacy, future beyond the city | Open sky, distant destinations, moments of warmth |
| Badlands / Nomad imagery | Freedom, movement, self-reliance | Frontier visuals and independent transmissions |
| Corporate ritual | Authority made sacred through seals, ceremony, contracts | Certificates, formal intake, classifications |
| Found family | Care that no archive or corporation can manufacture | Community contributions and collaborative art |

### Literary and philosophical touchstones

- **Neuromancer — William Gibson:** digital worlds, artificial intelligence, identity, cyberspace as a mysterious place.
- **Do Androids Dream of Electric Sheep? — Philip K. Dick:** empathy, authenticity, artificial life, what makes someone matter.
- **Solaris — Stanisław Lem:** the unknowable, grief, memory, limits of human interpretation.
- **Ubik — Philip K. Dick:** unstable reality, perception, death, uncertainty.
- **The Egyptian Book of the Dead:** passage, judgment, ritual, afterlife as thresholds.
- **The Tibetan Book of the Dead / Bardo Thodol:** transition, consciousness, liberation; treat its living religious context respectfully.

**Design test:** If a motif is only decoration, remove it or give it a narrative function. A shard should reveal something; a tarot reference should frame a choice; an anomaly should deepen the mystery.

## 4. Brand and visual direction

**Creative direction:** corporate archive meets forbidden spiritual manuscript. The site should feel authored, tactile, quiet, and slightly uncanny. Avoid defaulting to bright neon, aggressive glitch effects, generic hacker screens, or dense sci-fi UI on every page.

| Element | Guideline |
|---|---|
| Palette | Deep charcoal and dark green; bone-white text; muted jade; restrained gold; crimson sparingly |
| Materials | Aged paper, dark glass, brushed metal, archival labels, subtle grain, weathered walls, botanical traces |
| Typography | Readable body type; expressive serif/display titles; restrained monospaced metadata, IDs, timestamps, system labels |
| Layout | Editorial hierarchy, negative space, clear reading width, chapter transitions, responsive grids |
| Texture | Subtle grain, paper fibers, soft scanlines, etched lines, restrained noise; never compromise legibility |
| Imagery | Night City as a shadow, not the whole subject; ruins, murals, memorials, desert horizons, stars, plants, ritual objects |
| Motion | Slow fades and quiet reveals; restrained parallax only when useful; respect reduced-motion preferences |
| Sound | Optional and user-controlled; never autoplay. Silence is part of the design |
| Interaction | Clear focus, hover, active, disabled, and error states |

**Voice:** precise institutional language with poetic undertones; short memorable questions; uncertainty where evidence is uncertain; human emotion beneath the corporate surface. Avoid lore dumps and unexplained jargon.

**Accessibility rule:** the fiction can be mysterious; the interface must not be. Navigation, forms, consent, error messages, keyboard use, focus states, contrast, responsive behavior, and reduced-motion support must remain clear.

## 5. Information architecture

| Page / section | Fictional purpose | Visitor experience |
|---|---|---|
| Secure Your Soul | Public face of the program | Compelling promise, short introduction, primary action, first narrative question |
| The Protocol | Explains preservation | Conceptual stages, consent, limitations, official corporate account |
| The Archive / Mikoshi | Stores records and constructs | Case files, shards, construct logs, classifications, anomalies |
| The Arcana | Symbolic map of transformation | Chapters about beginnings, bargains, collapse, balance, hope, release |
| The Unknown | Unclassified phenomena | Signals, disputed accounts, unexplained events, gaps, unresolved questions |
| The Garden / Signals | Human counter-archive | Published poems, music, images, reflections, visitor transmissions |
| The Circle | Community and connection | Discord invitation, community guidelines, channel preview, collaboration |
| The Workshop | Actual project development | GitHub repository, issues, proposals, contribution guidance |
| The Exit / Release | Final question | Reflection on preservation, consent, freedom, and letting go |

Each page should answer one question, raise another, and give visitors a reason to continue. Full-screen viewing can support a chapter-like experience, but ordinary navigation and accessibility controls must remain available.

## 6. The three lifepaths

Street Kid, Corpo, and Nomad are narrative entry paths expressing different attitudes toward the system. They are not mandatory account types, permissions, or restrictions.

| Lifepath | Core attitude | Default route | Signal identity | Experience |
|---|---|---|---|---|
| **Street Kid** | Belonging, street-level knowledge, lived experience, culture | Discord / community | Street Signals | Conversation, music, discoveries, theories, collaboration |
| **Corpo** | Structure, institutional access, records, formal contribution | Website submission and curated archive | Archive Submissions | Essays, artwork, links, research, proposals |
| **Nomad** | Independence, movement, privacy, life beyond institutions | Low-friction open Signal form | Wilderness Transmissions | Pseudonymous or anonymous messages where feasible, photos, reflections, field notes |

**Cross-path principle:** a Street Kid may submit a formal document; a Corpo may join Discord; a Nomad may contribute code. The choice sets tone and gives the visitor an entry narrative, but does not restrict access.

### Suggested first-screen copy

> **SECURE YOUR SOUL**  
> Arasaka Corporation — Personality Preservation Program  
>  
> Your memories are not your whole self. Your body is not your only vessel. Your story does not have to end here.  
>  
> Before proceeding, identify your point of origin.  
>  
> **STREET KID / CORPO / NOMAD**

Keep fictional claims inside the fictional experience. Do not imply that the real website can upload, preserve, or assess a visitor's soul or personality.

## 7. Signals: concept, lifecycle, governance

A **Signal** is a fragment of human expression entering the Secure Your Soul world: a message, link, image, poem, music, observation, question, or larger creative contribution.

### Proposed lifecycle

1. Choose an entry path (optional for repeat visitors and never an access restriction).
2. Select a Signal type; provide content/media or links, attribution preference, and publication consent.
3. Validate required fields, size/type limits, spam controls, safe URL handling, and accessibility.
4. Acknowledge receipt without promising publication.
5. Review and moderate before anything appears publicly.
6. Publish, decline, or retain privately according to consent and policy.
7. Provide a way to request removal or correction of published material.

| Category | Examples | Potential handling |
|---|---|---|
| Street Signal | Question, recommendation, observation, music discovery | May invite community conversation; publish only with consent |
| Archive Submission | Essay, artwork, research, story, theory | Editorial review and clear attribution choice |
| Wilderness Transmission | Personal reflection, photo, note from outside the system | Low-friction intake; pseudonymous option if technically supported |
| Recovered Shard | Fictional document, diary fragment, invented incident log | Curated in-world content; label as fictional where appropriate |
| Anomaly Report | Unexplained behavior, contradictory evidence, strange signal | Review for safety and relevance; avoid asserting supernatural claims as fact |
| Workshop Proposal | Bug report, feature suggestion, code contribution | Route to GitHub issue or contribution guidance |

### Privacy and safety requirements

- Explain what is public/private and whether a name or handle will be displayed.
- Do not publish by default without explicit publication consent.
- Offer a removal/contact route and realistic response expectations.
- Validate uploads by type and size; do not trust file extensions alone.
- Protect against spam, abuse, malicious links, and unsafe file handling.
- Collect only necessary data; document retention and deletion behavior.
- Do not promise anonymity unless the technical design genuinely supports it.
- Keep real-world privacy notices and moderation rules understandable outside the fiction.

## 8. Platform and community architecture

| Layer | Platform | Purpose | Principle |
|---|---|---|---|
| Social | **Discord (proposed)** | Conversation, discoveries, music, art, collaboration | Use a real invite and clear rules; no placeholder join links |
| Institutional | **Website** | Fictional portal, Signal intake, curated archive | The website owns the narrative and durable public experience |
| Independent | **No-account website form** | Participation without joining another platform | Low friction, explicit consent, careful moderation |
| Development | **GitHub** | Source code, issues, proposals, transparent development | Keep actual development tools distinct from fictional UI |
| Optional operations | **Slack or another private workspace** | Private coordination if useful | Do not require public visitors to use a workplace chat product |

**Recommendation:** Discord for social community, website for narrative and submissions, GitHub for the real development workshop. Slack may remain optional for private operations; it need not be a visitor-facing lifepath destination.

External links should clearly disclose that they leave the website. The website must work for visitors who do not use Discord, Slack, or GitHub.

## 9. Functional requirements — initial backlog

| ID | Requirement | Priority | High-level acceptance criteria |
|---|---|---|---|
| FR-01 | Present identity and central narrative question | Must | First-time visitor understands premise and can continue |
| FR-02 | Offer three entry paths | Must | Each path is distinct; none blocks other features |
| FR-03 | Provide Signal submission | Must | Supported text/links submit with clear validation |
| FR-04 | Require consent before publication | Must | Publication choice is explicit; not public by default |
| FR-05 | Moderate submissions | Must | Unreviewed content cannot appear publicly |
| FR-06 | Display curated Signals | Should | Consistent layout, metadata, attribution, accessible media |
| FR-07 | Provide real Discord invitation | Should | Valid, current, clearly external |
| FR-08 | Link to GitHub contributions | Should | Repository, issue route, contribution guidance discoverable |
| FR-09 | Support removal/correction requests | Must | Process and ownership explained |
| FR-10 | Meet responsive/accessibility expectations | Must | Navigation, forms, focus, contrast, keyboard, reduced motion tested |
| FR-11 | Secure uploads and spam protections | Must | Type/size validation, server-side controls, moderation |
| FR-12 | Create layered narrative discoveries | Could | Chapters connect without hiding essential navigation |

### Out of scope for first iteration

- Custom Discord bot or cross-platform identity synchronization.
- Real digital-personality preservation service.
- Complex accounts, reputation scores, or public profiles before needed.
- Automatic publication of every visitor submission.
- Puzzles that block essential content or privacy information.

## 10. Non-functional requirements

- **Security:** least privilege, server-side validation, safe rendering, upload controls, secret management, dependency checks, and security headers where hosting supports them.
- **Privacy:** minimize collection, document consent, allow attribution choice where feasible, define retention/removal.
- **Accessibility:** semantic headings, keyboard access, visible focus, descriptive links, sufficient contrast, reduced motion, form labels, useful errors.
- **Performance:** optimized images, few unnecessary libraries, limited blocking scripts, restrained animation.
- **Reliability:** graceful handling of submission failures, missing media, unavailable third-party services, invalid links.
- **Maintainability:** consistent naming, reusable styles/components where appropriate, documented content types, simple deployment.
- **Portability:** preserve current GitHub Pages URL as main URL unless a future migration is explicitly approved.
- **Content integrity:** separate factual site information, fictional in-world content, and visitor submissions.
- **Moderation:** human review before public publication; provide report/removal route.

### Deployment guardrail

GitHub Pages remains the main site at https://iyakuza.github.io/landing-page/ unless explicitly changed. Cloudflare Pages may be used as a test environment for configuration and security behavior. Do not switch production URL or hosting without approval.

## 11. Acceptance checks

- A new visitor can explain the premise after viewing the entrance page.
- All three lifepaths are understandable, visually distinct, and optional.
- Choosing a path never prevents use of another platform or feature.
- A visitor can submit a Signal without joining Discord or Slack.
- The interface distinguishes receipt from approval/publication.
- Unreviewed submissions are not visible in the public archive.
- Consent, attribution, privacy, and removal information are clear outside the fiction.
- Forms work by keyboard and use accessible labels; errors explain recovery.
- The site is readable on mobile, desktop, and with reduced motion.
- External community and GitHub links are real, tested, and clearly identified.
- No page implies the real website uploads or preserves consciousness.
- Security and deployment checks pass before changes reach the primary site.

## 12. Decisions, assumptions, open questions

### Current decisions

- **Identity:** Secure Your Soul; restrained Cyberpunk-inspired corporate archive and spiritual mystery.
- **Lifepaths:** Street Kid, Corpo, and Nomad as narrative entry paths, not permissions.
- **Platform roles:** Discord for social community; website for submissions/archive; GitHub for development.
- **Main URL:** preserve the current GitHub Pages URL unless explicitly approved otherwise.

### Assumptions

- Reuse the existing submission/storage approach where suitable instead of adding a new service by default.

### Open questions

- Create/configure Discord server and provide a real invitation URL.
- Confirm submission fields, attribution choices, retention, removal route, upload types, and size limits.
- Define who moderates submissions and how often.
- Choose the first original case files, shards, Arcana, and hidden connections.
- Confirm final names for Archive, Garden, Circle, Workshop, and Exit.
- Choose original imagery and respect rights; avoid presenting third-party game assets as original work.

## 13. Implementation sequence

1. Inspect the current website, existing Signal/submission implementation, security controls, and page structure.
2. Map current pages to the proposed narrative and identify reusable work.
3. Prototype the entrance and three lifepath cards in the existing visual system; mark placeholders clearly.
4. Review the current backend; implement consent, validation, moderation, and removal behavior before reopening public publishing.
5. Add a real Discord invite only after the server exists; keep GitHub contribution links separate.
6. Create a small coherent set of original shards, archive entries, and symbolic chapters before expanding the lore.
7. Test accessibility, responsive behavior, security checks, form errors, external links, and deployment.
8. Verify the test environment, then deploy through the established workflow.

## 14. Decision log

| Date | Decision / change | Status |
|---|---|---|
| 2026-10-29 | Establish Secure Your Soul as a restrained corporate personality-preservation program with spiritual mystery beneath the surface | Decision |
| 2026-10-29 | Use Street Kid, Corpo, and Nomad as optional narrative entry paths | Decision |
| 2026-10-29 | Discord = social layer; website = Signal intake and curated archive; GitHub = development workshop; Slack optional for private operations | Decision |
| 2026-10-29 | Preserve existing GitHub Pages primary URL unless explicitly approved otherwise | Decision |
| 2026-10-29 | Restore the Signal concept with human moderation, explicit consent, and removal route | Proposal / implementation pending |

## North-star statement

A corporate promise of digital immortality conceals a spiritual mystery. Visitors enter through three lifepaths, discover fragments of an uncertain world, and leave Signals that may become part of a human archive. The technology promises preservation; the story asks what preservation means—and whether freedom matters more.
