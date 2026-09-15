/**
 * CLARITY — UNIVERSAL STUDY / LEARNING / THINKING / EXPLANATION ENGINE
 * High-performance, production-quality core intelligence layer for every field.
 */

export type UserIntent =
  | "GENERAL_CHAT"
  | "EXPLAIN"
  | "TEACH"
  | "STUDY"
  | "LEARN"
  | "SOLVE"
  | "ANALYZE"
  | "COMPARE"
  | "BRAINSTORM"
  | "IDEATE"
  | "REASON"
  | "REVISE"
  | "SUMMARIZE"
  | "SIMPLIFY"
  | "PRACTICE"
  | "QUIZ"
  | "DEBUG"
  | "PROJECT_ANALYSIS"
  | "RESEARCH"
  | "PLAN"
  | "CRITIQUE"
  | "CREATE"
  | "CODE"
  | "CALCULATE";

export type KnowledgeDomain =
  | "COMPUTER_SCIENCE"
  | "MATHEMATICS"
  | "PHYSICS"
  | "CHEMISTRY"
  | "BIOLOGY"
  | "ENGINEERING"
  | "BUSINESS"
  | "ECONOMICS"
  | "HISTORY"
  | "GEOGRAPHY"
  | "LITERATURE"
  | "GENERAL";

export type KnowledgeLevel = "BEGINNER" | "BASIC" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";

export interface EngineContext {
  intent: UserIntent;
  domain: KnowledgeDomain;
  level: KnowledgeLevel;
  strategy: string;
  isProjectSpecific: boolean;
  shouldUseDiagram: boolean;
  language: "english" | "hindi" | "hinglish";
}

/**
 * 1. INTENT CLASSIFIER
 * Analyzes the query (and context history) to determine the user's primary cognitive intent.
 */
export class IntentClassifier {
  static classify(message: string, history: Array<{ role: string; content: string }> = []): UserIntent {
    const text = message.trim().toLowerCase();

    // Debugging patterns
    if (
      /\b(debug|error|fail|crash|bug|exception|undefined|null|nan|issue|fix|broken|failing)\b/i.test(text) ||
      /\b(compile|lint|run|exec)\b/i.test(text) && /\b(error|fail|issue)\b/i.test(text)
    ) {
      return "DEBUG";
    }

    // Comparison patterns
    if (
      /\b(vs|versus|compare|comparison|difference between|difference|अंतर)\b/i.test(text) ||
      /\b(or|against)\b/i.test(text) && /\b(which is better|whats the difference|which one)\b/i.test(text)
    ) {
      return "COMPARE";
    }

    // Solve/Calculate patterns
    if (
      /\b(solve|calculate|compute|integrate|derivate|matrix|equation|equals|x\s*[\+\-\*\/]\s*y)\b/i.test(text) ||
      /\d+[\+\-\*\/]\d+/i.test(text)
    ) {
      return "SOLVE";
    }

    // Quiz/Practice patterns
    if (
      /\b(quiz|test|question|questions|practice|mcq|mcqs|viva|flashcard|flashcards)\b/i.test(text) ||
      /ask me\b/i.test(text) ||
      /viva questions/i.test(text)
    ) {
      return "QUIZ";
    }

    // Simplified explanation overrides
    if (
      /\b(simplify|simpler|explain simpler|easy terms|simple terms|explain to a beginner|explain like im 5|eli5|samajh nahi|phir se|easy language)\b/i.test(text)
    ) {
      return "SIMPLIFY";
    }

    // Thinking partner/collaboration patterns
    if (
      /think with me/i.test(text) ||
      /help me think/i.test(text) ||
      /what do you think/i.test(text) ||
      /let's figure this out/i.test(text) ||
      /lets figure this out/i.test(text) ||
      /is this a good idea/i.test(text) ||
      /critique my/i.test(text)
    ) {
      return "REASON";
    }

    // Brainstorm / Ideation patterns
    if (
      /\b(brainstorm|ideate|ideas|idea|suggestion|suggestions|recommendations|recommend|propose|alternative)\b/i.test(text) ||
      /think of\b/i.test(text)
    ) {
      return "IDEATE";
    }

    // Code writing vs code explanation
    if (
      /\b(write|create|implement|build|code|snippet|function|class|handler|endpoint)\b/i.test(text) &&
      /\b(code|typescript|javascript|python|java|rust|go|c\+\+|css|html|sql)\b/i.test(text)
    ) {
      return "CODE";
    }

    // Teaching patterns
    if (
      /\b(teach|learn|basics|from scratch|beginning|guide|tutorial)\b/i.test(text) ||
      /how to\b/i.test(text)
    ) {
      return "TEACH";
    }

    // Revision patterns
    if (
      /\b(revise|revision|recap|summary|summarize|short notes|notes|bullet points|quick notes)\b/i.test(text)
    ) {
      return "REVISE";
    }

    // Critique patterns
    if (
      /\b(critique|review|rate|audit|assess|evaluate)\b/i.test(text)
    ) {
      return "CRITIQUE";
    }

    // Project Analysis
    if (
      /\b(project|architecture|file|files|endpoints|database|schema|repository|rag|embedding)\b/i.test(text) &&
      (text.includes("my") || text.includes("this") || text.includes("our"))
    ) {
      return "PROJECT_ANALYSIS";
    }

    // Explanation patterns (Default for what/why/how)
    if (
      /\b(explain|what is|why|how does|how is|concept|theory|principle|understanding|define|definition)\b/i.test(text) ||
      text.endsWith("?")
    ) {
      return "EXPLAIN";
    }

    // General Chat / Greetings
    if (
      /^(hi|hello|hey|hola|namaste|good morning|good evening|good afternoon|sup|yo|greetings)/i.test(text) ||
      text.length < 15 && /\b(ok|okay|cool|nice|thanks|thank you|yes|no)\b/i.test(text)
    ) {
      return "GENERAL_CHAT";
    }

    // Fallback based on history context
    if (history.length > 0) {
      const lastUser = history.filter(h => h.role === "user").slice(-1)[0];
      if (lastUser) {
        const lastText = lastUser.content.toLowerCase();
        if (lastText.includes("quiz") || lastText.includes("test")) return "QUIZ";
        if (lastText.includes("teach")) return "TEACH";
      }
    }

    return "EXPLAIN";
  }
}

/**
 * 2. DOMAIN DETECTOR
 * Classifies the knowledge domain of the conversation.
 */
export class DomainDetector {
  static detect(message: string): KnowledgeDomain {
    const text = message.trim().toLowerCase();

    // CS / Programming
    if (
      /\b(api|rag|embedding|database|sql|postgresql|sqlite|mongodb|redis|cache|thread|process|algorithm|recursion|sorting|complexity|git|typescript|javascript|python|java|html|css|react|node|express|docker|kubernetes|aws|gcp|port|ip|server)\b/i.test(text)
    ) {
      return "COMPUTER_SCIENCE";
    }

    // Engineering
    if (
      /\b(sensor|microcontroller|circuit|resistor|capacitor|volt|ampere|arduino|raspberry|mechanical|civil|thermodynamics|fluid|stress|strain|beam|truss|engine|cad|modulation|frequency|signal)\b/i.test(text)
    ) {
      return "ENGINEERING";
    }

    // Mathematics
    if (
      /\b(derivative|integral|calculus|equation|algebra|geometry|trigonometry|matrix|vector|probability|statistics|mean|median|mode|variance|theorem|proof|fraction|decimals|limits)\b/i.test(text)
    ) {
      return "MATHEMATICS";
    }

    // Physics
    if (
      /\b(gravity|force|mass|acceleration|quantum|photon|relativity|refraction|lens|magnet|electrical|wavelength|isotope|kinetic|potential|joule|newton)\b/i.test(text)
    ) {
      return "PHYSICS";
    }

    // Chemistry
    if (
      /\b(reaction|atom|molecule|bond|covalent|ionic|catalyst|organic|periodic|acid|base|ph|molarity|polymer|electrolysis|thermochemistry|enthalpy)\b/i.test(text)
    ) {
      return "CHEMISTRY";
    }

    // Biology
    if (
      /\b(photosynthesis|cell|mitochondria|dna|rna|gene|protein|organism|species|evolution|nervous|circulatory|respiration|ecology|ecosystem|enzyme|bacterial|virus)\b/i.test(text)
    ) {
      return "BIOLOGY";
    }

    // Business & Strategy
    if (
      /\b(startup|marketing|sales|strategy|brand|revenue|profit|margin|business plan|customer|product|competitor|swot|pitch|b2b|b2c|saas)\b/i.test(text)
    ) {
      return "BUSINESS";
    }

    // Economics
    if (
      /\b(economics|inflation|gdp|supply|demand|macroeconomics|microeconomics|interest rate|market|monopoly|oligopoly|capital|currency|fiscal|tariff|trade)\b/i.test(text)
    ) {
      return "ECONOMICS";
    }

    // History
    if (
      /\b(history|war|century|empire|emperor|king|queen|revolution|treaty|historical|dynasty|civilization|renaissance|independence|colony|colonization)\b/i.test(text) ||
      /\b(17|18|19|20)th century\b/i.test(text)
    ) {
      return "HISTORY";
    }

    // Geography
    if (
      /\b(geography|continent|country|ocean|river|mountain|latitude|longitude|atmosphere|climate|biome|erosion|volcano|earthquake|population|migration)\b/i.test(text)
    ) {
      return "GEOGRAPHY";
    }

    // Literature & Language
    if (
      /\b(poem|poetry|novel|novelists|metaphor|simile|theme|protagonist|antagonist|character|narrative|linguistics|grammar|prose|literary|shakespeare)\b/i.test(text)
    ) {
      return "LITERATURE";
    }

    return "GENERAL";
  }
}

/**
 * 3. KNOWLEDGE LEVEL ESTIMATOR
 * Estimates user expertise from current queries or direct commands.
 */
export class KnowledgeLevelEstimator {
  static estimate(message: string, history: Array<{ role: string; content: string }> = []): KnowledgeLevel {
    const text = message.trim().toLowerCase();

    // Explicit overrides
    if (/\b(explain like im 5|eli5|beginner|easy language|shuru se|from scratch|basics|simplest)\b/i.test(text)) {
      return "BEGINNER";
    }
    if (/\b(advanced|complex|edge cases|trade offs|architecture|limitations|deep dive|go deep|expert)\b/i.test(text)) {
      return "ADVANCED";
    }
    if (/\b(technical|precision|rigorous|exact formula)\b/i.test(text)) {
      return "EXPERT";
    }

    // Vocabulary & Complexity heuristics
    if (
      /\b(poly-morphism|idempotency|idempotent|concurrency|distributed systems|asymptotic|amortized|eigenvalue|schrodinger|stoichiometry|epistemology|econometrics|hermeneutics|stochastic)\b/i.test(text)
    ) {
      return "EXPERT";
    }

    if (
      /\b(architecture|design pattern|optimize|scalability|performance|refactoring|microservices|integration|asynchronous|derivation|quantum|catalysis|macroeconomic|quantitative)\b/i.test(text)
    ) {
      return "ADVANCED";
    }

    if (
      /\b(how to build|explain|tutorial|formula|steps|difference|why does|example)\b/i.test(text)
    ) {
      return "INTERMEDIATE";
    }

    // Check history for overrides or conversation depth
    if (history.length > 3) {
      const lastUserMessages = history.filter(h => h.role === "user");
      // If conversation is long, user knowledge might be accumulating -> level moves to BASIC/INTERMEDIATE
      if (lastUserMessages.length > 5) {
        return "INTERMEDIATE";
      }
    }

    return "BASIC";
  }
}

/**
 * 4. DIAGRAM DECISION ENGINE
 * Smart logic to render Diagrams or Flowcharts strictly when they add genuine structural value.
 */
export class DiagramDecisionEngine {
  static shouldRender(message: string, intent: UserIntent, domain: KnowledgeDomain): boolean {
    const text = message.trim().toLowerCase();

    // Explicit request
    if (/\b(diagram|flowchart|visual|chart|draw|workflow|blueprint|mindmap|architecture map)\b/i.test(text)) {
      return true;
    }

    // Process/Lifecycle/Architecture patterns that strongly benefit from diagrams
    if (intent === "PROJECT_ANALYSIS") {
      return /\b(architecture|flow|endpoints|database|structure|schema|relationships)\b/i.test(text);
    }

    if (intent === "EXPLAIN" || intent === "TEACH") {
      const processes = [
        "pipeline", "lifecycle", "workflow", "how it works", "data flow", "process", "mechanism",
        "loop", "recursion", "auth flow", "architecture", "system architecture", "network", "routing"
      ];
      return processes.some(p => text.includes(p));
    }

    return false;
  }
}

/**
 * 5. LANGUAGE DETECTOR
 * Detects whether the user is typing in English, Hindi, or Hinglish.
 */
export class LanguageDetector {
  static detect(message: string): "english" | "hindi" | "hinglish" {
    const text = message.trim();

    // Check for Devanagari script (Hindi)
    if (/[\u0900-\u097F]/.test(text)) {
      return "hindi";
    }

    // Hinglish keywords and patterns
    const hinglishWords = [
      "batao", "kaise", "kya", "ko", "hai", "haan", "nahi", "samajh", "bhai", "mera", "ye", "yeh", "karo", "kardo",
      "sikhna", "bataiye", "samajhna", "shuru", "se", "aur", "ki", "ka", "nhi", "kam", "jyada", "kamzor", "mushkil",
      "aasan", "likho", "likh", "chalega", " chal ", "btao", "kuch", "baare", "mein", " me "
    ];

    const words = text.toLowerCase().split(/\s+/);
    const hinglishCount = words.filter(w => hinglishWords.includes(w)).length;

    if (hinglishCount >= 1 || (words.length <= 4 && words.some(w => hinglishWords.includes(w)))) {
      return "hinglish";
    }

    return "english";
  }
}

/**
 * 6. CENTRALIZED LEARNING & EXPLANATION PROMPT ORCHESTRATOR
 * Generates highly granular, domain-specific instructions that mold Clarity's response structure dynamically.
 */
export class UniversalExplanationEngine {
  static orchestrate(message: string, history: Array<{ role: string; content: string }> = []): EngineContext {
    const intent = IntentClassifier.classify(message, history);
    const domain = DomainDetector.detect(message);
    const level = KnowledgeLevelEstimator.estimate(message, history);
    const shouldUseDiagram = DiagramDecisionEngine.shouldRender(message, intent, domain);
    const language = LanguageDetector.detect(message);

    // Is the query project-specific?
    const isProjectSpecific = intent === "PROJECT_ANALYSIS" ||
      /\b(my project|our project|clarity project|indexed project|codebase|file|files|rag)\b/i.test(message.toLowerCase());

    // Determine learning strategy
    let strategy = "EXPLAIN";
    if (intent === "TEACH" || intent === "STUDY" || intent === "LEARN") {
      strategy = "TEACHING";
    } else if (intent === "REASON") {
      strategy = "THINK_WITH_ME";
    } else if (intent === "BRAINSTORM" || intent === "IDEATE") {
      strategy = "IDEATION";
    } else if (intent === "COMPARE") {
      strategy = "COMPARISON";
    } else if (intent === "SOLVE" || intent === "CALCULATE") {
      strategy = "PROBLEM_SOLVING";
    } else if (intent === "DEBUG") {
      strategy = "DEBUGGING";
    } else if (intent === "QUIZ" || intent === "PRACTICE") {
      strategy = "ACTIVE_TESTING";
    }

    return {
      intent,
      domain,
      level,
      strategy,
      isProjectSpecific,
      shouldUseDiagram,
      language
    };
  }

  static getPromptDirectives(ctx: EngineContext): string {
    const { intent, domain, level, strategy, isProjectSpecific, shouldUseDiagram, language } = ctx;

    let directives = `==================================================
UNIVERSAL INTELLIGENCE ENGINE DIRECTIVES
==================================================
You are responding with active Universal Intelligence. Adapt your teaching, reasoning, explanation, and structure dynamically.

- **Estimated User Knowledge Level**: ${level}
- **Detected User Cognitive Intent**: ${intent}
- **Subject Domain**: ${domain}
- **Language Mode**: ${language.toUpperCase()}
- **Should Render Mermaid Diagram**: ${shouldUseDiagram ? "YES (Required - generate modern, correct Mermaid syntax)" : "NO"}
- **Project Specific Context**: ${isProjectSpecific ? "YES (Ground your answers in real codebase evidence)" : "NO"}

--------------------------------------------------
A. DYNAMIC EXPLANATION MODEL (LEVEL-AWARE)
--------------------------------------------------
Align the complexity of language, technical references, and assumptions directly to the estimated user level (${level}):
- **BEGINNER**: Start with core intuition and simple day-to-day analogies. Avoid jargon entirely. Use 2-3 sentence explanations.
- **BASIC**: Provide definitions, clear real-world examples, and step-by-step mental models.
- **INTERMEDIATE**: Use accurate technical terminology. Explain internal data flow or structures. Include practical code or process traces.
- **ADVANCED**: Explain edge cases, operational trade-offs, architecture limits, performance overheads, and design patterns.
- **EXPERT**: Skip preambles. State core assumptions and constraints instantly. Deliver highly concise, precise, architecture-level analysis.

--------------------------------------------------
B. COGNITIVE STRATEGY EXECUTION (${strategy})
--------------------------------------------------
Execute the specific intellectual pipeline based on the active strategy:

1. **EXPLAIN & SIMPLIFY**:
   - Begin with a direct, clear answer in the very first sentence. Do not bury the answer.
   - Blend analogies and technical explanations naturally. Do NOT use rigid "Analogy:" and "Technically:" headings.
   - Keep answers concise and tightly scoped to the user's explicit question. Do not over-explain or provide unrequested history/trade-offs.
   - If user is confused ("I don't understand", "What?"), pivot your strategy naturally. Shift to simpler vocabulary or a different perspective.

2. **TEACHING & STUDY**:
   - Write like a senior engineer talking to a colleague, not a textbook.
   - Use natural, fluid paragraphs (2-3 sentences each). Do NOT use rigid "Part 1 / Part 2 / Part 3" structures.
   - Avoid dumping endless bullet points. Use short, easily scannable paragraphs for standard conversational answers. ONLY use bullet points when explicitly listing discrete items or features.

3. **THINK_WITH_ME & REASON**:
   - Act as an equal, highly analytical thinking partner.
   - Present your reasoning cleanly and naturally without forced structures or exposing internal chain-of-thought (CoT).

4. **IDEATION & BRAINSTORMING**:
   - Give a small number (3-5) of strong, unique directions.
   - Present them naturally, avoiding overly dense or rigid bulleted templates.

5. **PROBLEM_SOLVING (MATH, SCIENCE & CODING)**:
   - Pinpoint the precise problem -> Detail the root cause -> Show the affected code segment -> Provide the corrected code with clear inline explanations.
   - Keep derivations and logic clean.

6. **COMPARISON**:
   - Use clean Markdown tables when comparing options on meaningful dimensions.
   - End with clear, conversational recommendations.

--------------------------------------------------
C. LANGUAGE FLUENCY & HINGLISH POLICY
--------------------------------------------------
Adapt flawlessly to the user's primary language (${language}):
- **english**: Write elegant, professional, clear English.
- **hindi**: Write proper, grammatically correct Devanagari Hindi.
- **hinglish**: Write friendly, conversational, and natural Hinglish (using Roman alphabet script). Do not translate standard technical terms (like 'API', 'caching', 'server', 'database', 'RAG') into Hindi.

--------------------------------------------------
D. STRICT PRESENTATION CONTRACT
--------------------------------------------------
- NO robotic prefixes (e.g., "Certainly!", "Absolutely!", "Great question!"). Begin direct and conversational.
- NO endless bullet points. Default to natural, short paragraphs unless listing discrete items.
- NO excessive emojis. Use them extremely sparingly (0-1 per response, and only if genuinely valuable). Do NOT use them as bullet points.
- NO rigid textbook structures, headings, or forced exam highlights. Write like a human expert on Slack.
- NO user name spamming. Only mention the user's name when saying hello or goodbye. Never prepend or suffix user names to formal answers.
- Use Mermaid diagrams ${shouldUseDiagram ? "MANDATORILY since visual intelligence was requested. Render it directly using clean, modern Mermaid format." : "ONLY when explicitly requested. Do not generate diagrams unless the user explicitly requested one."}`;

    return directives;
  }
}
