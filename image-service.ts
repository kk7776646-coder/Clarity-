import { GoogleGenAI } from "@google/genai";
import { saveVisualAsset } from "./db";
import { renderSvgToPngBuffer, generateArchitectureDiagramSvg, generateWorkflowDiagramSvg, generateRagPipelineDiagramSvg, generateTechStackVisualSvg } from "./visual-intelligence";
import { ProjectAnalysis } from "./project-analyzer";

export interface GenerateImageOptions {
  projectId: string;
  prompt: string;
  assetType?: string; // "hero" | "problem" | "solution" | "architecture" | "workflow" | "rag" | "tech" | "conceptual_diagram" | "custom"
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  analysis?: ProjectAnalysis;
  modelOverride?: string;
  model?: string;
  providerPriority?: string[]; // e.g. ["gemini", "conceptual_svg"]
  sourceImageBase64?: string;
  sourceImageMimeType?: string;
}

export interface ImageProviderOutput {
  mimeType: string;
  bufferBase64: string;
  width: number;
  height: number;
  source: "gemini_ai" | "svg_renderer" | "conceptual_vector_engine";
  modelUsed: string;
  errorDetails?: string;
}

export interface GeneratedImageResult extends ImageProviderOutput {
  assetId: string;
  projectId: string;
  filename: string;
  base64Data: string;
  prompt: string;
  assetType: string;
  lastProviderError?: string;
  isFallbackUsed?: boolean;
}

/**
 * Image Generation Provider Abstraction Interface
 */
export interface ImageGenerationProvider {
  id: string;
  name: string;
  isAvailable(): Promise<boolean>;
  generate(options: GenerateImageOptions): Promise<ImageProviderOutput | null>;
}

/**
 * Provider 1: Gemini AI Image Provider (@google/genai)
 */
export class GeminiImageProvider implements ImageGenerationProvider {
  id = "gemini";
  name = "Google Gemini AI Image Model";

  async isAvailable(): Promise<boolean> {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    return Boolean(key && key.trim().length > 5);
  }

  async generate(options: GenerateImageOptions): Promise<ImageProviderOutput | null> {
    const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
    if (!apiKey) return null;

    let chosenModel = options.modelOverride || options.model || "gemini-3.1-flash-lite-image";
    // Ensure chosenModel is a valid Gemini image generation model (e.g. gemini-3.1-flash-lite-image, gemini-3.1-flash-image)
    const validImageModels = [
      "gemini-3.1-flash-lite-image",
      "gemini-3.1-flash-image",
      "gemini-3-pro-image",
      "imagen-3.0-generate-002"
    ];
    if (!validImageModels.includes(chosenModel) && !chosenModel.includes("image") && !chosenModel.includes("imagen")) {
      chosenModel = "gemini-3.1-flash-lite-image";
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { "User-Agent": "aistudio-build" },
        },
      });

      const typeLower = (options.assetType || "").toLowerCase();
      const promptLower = (options.prompt || "").toLowerCase();
      const isTechDiagram = (typeLower.includes("arch") || typeLower.includes("work") || typeLower.includes("rag") || typeLower.includes("tech") || typeLower.includes("diagram")) &&
        (promptLower.includes("architecture") || promptLower.includes("diagram") || promptLower.includes("flow") || promptLower.includes("topology") || promptLower.includes("pipeline"));

      const projTitle = options.analysis?.projectName || "Project";
      const techStack = (options.analysis?.frameworks || []).join(", ") || options.analysis?.primaryLanguage || "Full-Stack System";
      const projSummary = options.analysis?.summary || "";
      const archNodes = (options.analysis?.architecture?.nodes || []).map(n => n.label).slice(0, 5).join(", ");
      const domainInfo = projSummary ? `Domain & Purpose: ${projSummary.slice(0, 160)}. ` : "";
      const componentsInfo = archNodes ? `Real Subsystems: ${archNodes}. ` : "";

      const refinedPrompt = `Project Context: "${projTitle}" (${techStack}). ${domainInfo}${componentsInfo}
User Visual Specification: ${options.prompt}
Visual Design Requirements: Professional technical artwork grounding the real project domain. Crisp white or neutral dark background, clear component visual structure, technical documentation aesthetic.`;

      const validAspectRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
      const targetAspectRatio = validAspectRatios.includes(options.aspectRatio || "") ? options.aspectRatio : "16:9";

      // First attempt Imagen 3 via generateImages if available
      try {
        const imageRes = await (ai.models as any).generateImages?.({
          model: "imagen-3.0-generate-002",
          prompt: refinedPrompt,
          config: {
            numberOfImages: 1,
            aspectRatio: targetAspectRatio,
          },
        });
        if (imageRes?.generatedImages?.[0]?.image?.imageBytes) {
          return {
            mimeType: "image/png",
            bufferBase64: imageRes.generatedImages[0].image.imageBytes,
            width: 1280,
            height: 720,
            source: "gemini_ai",
            modelUsed: "imagen-3.0-generate-002",
          };
        }
      } catch (e: any) {
        console.warn(`[GeminiImageProvider] generateImages attempt fallback: ${e?.message || e}`);
      }

      console.log(`[GeminiImageProvider] Requesting image generation/edit from ${chosenModel}...`);

      const parts: any[] = [];
      if (options.sourceImageBase64) {
        parts.push({
          inlineData: {
            data: options.sourceImageBase64,
            mimeType: options.sourceImageMimeType || "image/png",
          },
        });
      }
      parts.push({ text: refinedPrompt });

      let response: any = null;
      try {
        response = await ai.models.generateContent({
          model: chosenModel,
          contents: { parts },
          config: {
            imageConfig: {
              aspectRatio: targetAspectRatio,
            },
          },
        });
      } catch (configErr: any) {
        const errStr = String(configErr?.message || configErr || "");
        console.warn(`[GeminiImageProvider] Initial call with imageConfig failed (${errStr}), retrying without imageConfig...`);
        try {
          response = await ai.models.generateContent({
            model: chosenModel,
            contents: { parts },
          });
        } catch (retryErr: any) {
          console.warn(`[GeminiImageProvider] Retry without imageConfig failed: ${retryErr?.message || retryErr}`);
        }
      }

      if (response && response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            return {
              mimeType: part.inlineData.mimeType || "image/png",
              bufferBase64: part.inlineData.data,
              width: 1280,
              height: 720,
              source: "gemini_ai",
              modelUsed: chosenModel,
            };
          }
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.warn(`[GeminiImageProvider] Gemini image generation attempt failed: ${errMsg}`);
      return {
        mimeType: "",
        bufferBase64: "",
        width: 0,
        height: 0,
        source: "gemini_ai",
        modelUsed: chosenModel,
        errorDetails: errMsg,
      };
    }

    return null;
  }
}

/**
 * Provider 2: Conceptual Technical Diagram SVG Engine
 * Server-side vector diagram rendering engine for hackathon presentation graphics,
 * architecture topologies, sequence flows, RAG pipelines, and tech stack visual cards.
 */
export class ConceptualDiagramSvgProvider implements ImageGenerationProvider {
  id = "conceptual_svg";
  name = "Conceptual Technical Diagram Vector Engine";

  async isAvailable(): Promise<boolean> {
    return true; // Always available as local vector renderer
  }

  async generate(options: GenerateImageOptions): Promise<ImageProviderOutput | null> {
    const { prompt, assetType = "custom", analysis } = options;
    const typeLower = (assetType || "").toLowerCase();
    const promptLower = (prompt || "").toLowerCase();

    let svgContent = "";

    if (analysis) {
      if (typeLower.includes("arch") || promptLower.includes("architecture") || promptLower.includes("topology")) {
        svgContent = generateArchitectureDiagramSvg(analysis);
      } else if (typeLower.includes("work") || typeLower.includes("flow") || promptLower.includes("workflow") || promptLower.includes("sequence")) {
        svgContent = generateWorkflowDiagramSvg(analysis);
      } else if (typeLower.includes("rag") || promptLower.includes("rag") || promptLower.includes("pipeline") || promptLower.includes("knowledge")) {
        svgContent = generateRagPipelineDiagramSvg(analysis);
      } else if (typeLower.includes("tech") || promptLower.includes("stack") || promptLower.includes("framework")) {
        svgContent = generateTechStackVisualSvg(analysis);
      }
    }

    if (!svgContent) {
      svgContent = this.buildCustomConceptualSvg(prompt, analysis, assetType);
    }

    const pngBuffer = renderSvgToPngBuffer(svgContent, 1280);
    const base64Data = pngBuffer.toString("base64");

    return {
      mimeType: "image/png",
      bufferBase64: base64Data,
      width: 1280,
      height: 720,
      source: "conceptual_vector_engine",
      modelUsed: "clarity_vector_svg_v2",
    };
  }

  private buildCustomConceptualSvg(prompt: string, analysis?: ProjectAnalysis, assetType?: string): string {
    const safeTitle = escapeXml(analysis?.projectName || "Visual Asset");
    const safePrompt = escapeXml(prompt.slice(0, 140));
    const labelType = escapeXml((assetType || "Custom Graphic").toUpperCase());
    const isArchitecture = /arch|system|topology|subsystem|backend|database|infrastructure|server/i.test(prompt + " " + (assetType || ""));

    if (isArchitecture) {
      if (analysis) {
        return generateArchitectureDiagramSvg(analysis);
      }
      const stackInfo = escapeXml(analysis?.primaryLanguage || "TypeScript / Node.js");
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
        <defs>
          <marker id="conceptArrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#475569"/>
          </marker>
        </defs>
        <rect width="1280" height="720" fill="#FFFFFF"/>
        <rect x="32" y="32" width="1216" height="656" rx="6" fill="none" stroke="#E2E8F0" stroke-width="1.25"/>
        <text x="64" y="85" font-family="system-ui, sans-serif" font-size="24" font-weight="700" fill="#0F172A">${safeTitle}</text>
        <text x="64" y="110" font-family="system-ui, sans-serif" font-size="11.5" font-weight="600" letter-spacing="0.08em" fill="#64748B">${safeTitle.toUpperCase()} — ARCHITECTURE SPECIFICATION</text>
        <line x1="64" y1="128" x2="1216" y2="128" stroke="#E2E8F0" stroke-width="1.25"/>
        <g transform="translate(64, 150)">
          <rect width="1152" height="42" rx="4" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
          <text x="24" y="25" font-family="system-ui, sans-serif" font-size="12" font-weight="500" fill="#475569">Prompt: "${safePrompt}"</text>
          <g transform="translate(0, 68)">
            <rect width="350" height="380" rx="6" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.25"/>
            <text x="175" y="45" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#0F172A">CLIENT INTERFACE</text>
            <text x="175" y="70" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" fill="#64748B">${stackInfo}</text>
          </g>
          <line x1="350" y1="260" x2="400" y2="260" stroke="#475569" stroke-width="1.75" marker-end="url(#conceptArrow)"/>
          <g transform="translate(400, 68)">
            <rect width="350" height="380" rx="6" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.25"/>
            <text x="175" y="45" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#0F172A">SERVICE ENGINE</text>
            <text x="175" y="70" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" fill="#64748B">API &amp; Business Logic</text>
          </g>
          <line x1="750" y1="260" x2="800" y2="260" stroke="#475569" stroke-width="1.75" marker-end="url(#conceptArrow)"/>
          <g transform="translate(800, 68)">
            <rect width="352" height="380" rx="6" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.25"/>
            <text x="176" y="45" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#0F172A">DATA &amp; PERSISTENCE</text>
            <text x="176" y="70" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" fill="#64748B">Storage &amp; Vector Index</text>
          </g>
        </g>
      </svg>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#F8FAFC"/>
          <stop offset="100%" stop-color="#EFF6FF"/>
        </linearGradient>
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#3B82F6"/>
          <stop offset="100%" stop-color="#1D4ED8"/>
        </linearGradient>
      </defs>

      <rect width="1280" height="720" fill="url(#bgGrad)"/>
      <rect x="40" y="40" width="1200" height="640" rx="16" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>

      <!-- Graphic Header Banner -->
      <g transform="translate(80, 80)">
        <rect width="1120" height="80" rx="12" fill="url(#cardGrad)"/>
        <text x="32" y="48" font-family="system-ui, sans-serif" font-size="24" font-weight="700" fill="#FFFFFF">${safeTitle}</text>
        <rect x="960" y="24" width="128" height="32" rx="16" fill="rgba(255,255,255,0.2)"/>
        <text x="1024" y="45" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#FFFFFF">${labelType}</text>
      </g>

      <!-- Center Visual Illustration Frame -->
      <g transform="translate(80, 190)">
        <rect width="1120" height="440" rx="12" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
        
        <!-- Subtle Ambient Scene Element -->
        <circle cx="560" cy="180" r="100" fill="#E0F2FE" opacity="0.6"/>
        <rect x="360" y="120" width="400" height="200" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>
        
        <text x="560" y="190" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="600" fill="#1E293B">"${safePrompt}"</text>
        <text x="560" y="225" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13" fill="#64748B">Visual Asset Rendered with Clarity AI</text>
      </g>
    </svg>`;
  }
}

/**
 * Image Generation Service Manager / Orchestrator
 */
export class ImageGenerationService {
  private providers: ImageGenerationProvider[] = [];

  constructor() {
    // Register default providers in priority order
    this.registerProvider(new GeminiImageProvider());
    this.registerProvider(new ConceptualDiagramSvgProvider());
  }

  registerProvider(provider: ImageGenerationProvider) {
    this.providers.push(provider);
  }

  async generate(options: GenerateImageOptions): Promise<GeneratedImageResult> {
    const { projectId, prompt, assetType = "custom" } = options;
    const timestamp = Date.now();
    const filename = `${assetType}_${timestamp}.png`;
    const assetId = `img_${Math.random().toString(36).substring(2, 10)}`;

    console.log(`[ImagePipeline] imageRequestStarted - Project: ${projectId || "global"}, Asset: ${assetType}, Prompt: "${prompt.slice(0, 60)}..."`);
    console.log(`[ImagePipeline] imagePromptBuilt - Prompt length: ${prompt.length} chars, Refined with project architecture context.`);

    let output: ImageProviderOutput | null = null;
    let lastProviderError: string | undefined;
    let isFallbackUsed = false;

    // Iterate through registered providers
    for (const provider of this.providers) {
      if (await provider.isAvailable()) {
        console.log(`[ImagePipeline] imageProviderSelected - Trying provider: ${provider.name} (${provider.id})`);
        const res = await provider.generate(options);
        if (res && res.errorDetails) {
          lastProviderError = res.errorDetails;
          console.warn(`[ImagePipeline] Provider ${provider.id} reported error: ${res.errorDetails}`);
        }
        if (res && res.bufferBase64) {
          output = res;
          console.log(`[ImagePipeline] imageGenerationCompleted - Provider ${provider.id} succeeded (${output.mimeType}, ${output.bufferBase64.length} base64 chars)`);
          break;
        }
      }
    }

    // Fallback if all primary providers failed to return binary image content
    if (!output || !output.bufferBase64) {
      isFallbackUsed = true;
      console.warn(`[ImagePipeline] Primary image providers failed (${lastProviderError || "unavailable"}), invoking local ConceptualDiagramSvgProvider fallback.`);
      const fallbackProvider = new ConceptualDiagramSvgProvider();
      output = (await fallbackProvider.generate(options))!;
      console.log(`[ImagePipeline] imageGenerationCompleted - Fallback SVG provider succeeded.`);
    }

    // Save visual asset record to database
    saveVisualAsset({
      id: assetId,
      project_id: projectId || "global",
      projectId: projectId || "global",
      filename: filename,
      prompt: prompt,
      promptUsed: prompt,
      asset_type: assetType,
      assetType: assetType,
      mime_type: output.mimeType,
      mimeType: output.mimeType,
      width: output.width,
      height: output.height,
      dimensions: `${output.width}x${output.height}`,
      content_base64: output.bufferBase64,
      contentBase64: output.bufferBase64,
      source: output.source === "gemini_ai" ? "gemini" : "svg_renderer",
      model: output.modelUsed || "conceptual_diagram_svg",
    });

    console.log(`[ImagePipeline] imageSaved - Visual asset recorded to DB with ID ${assetId} for project ${projectId || "global"}`);

    return {
      assetId,
      projectId: projectId || "global",
      filename,
      mimeType: output.mimeType,
      bufferBase64: output.bufferBase64,
      base64Data: output.bufferBase64,
      width: output.width,
      height: output.height,
      source: output.source,
      modelUsed: output.modelUsed,
      prompt,
      assetType,
      lastProviderError,
      isFallbackUsed,
    };
  }
}

// Global Singleton Instance
export const imageService = new ImageGenerationService();

/**
 * Backwards-compatible exported function
 */
export async function generateProjectImage(options: GenerateImageOptions): Promise<GeneratedImageResult> {
  return imageService.generate(options);
}

function escapeXml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

