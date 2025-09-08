# Plugin Refactoring Prompt (PRP): Regression-Safe Simplified Pre-Processing

## Context

You are refactoring a Joplin plugin that converts markdown to HTML with base64 image embedding. The simplified pre-processing approach is correct, but must be **precisely scoped** to prevent regressions. Current behavior must be preserved exactly while eliminating the complex 3-pass dimension pipeline.

## Critical Correctness Requirements

Based on detailed analysis, these gaps **must** be addressed to prevent regressions:

1. **Scope to image contexts only** - No replacements in links, plain text, or code
2. **Preserve code blocks/inline code** - Use existing `REGEX_PATTERNS.CODE_BLOCKS` segmentation
3. **Respect resource types** - Only process images, leave PDF/file links untouched
4. **Maintain embedImages=false behavior** - Strip Joplin images, preserve remote images
5. **Validate remote images properly** - Use Content-Type, not file extensions
6. **Keep failure semantics** - Replace failed images with error spans, not original URLs

## Implementation Requirements

### 1. Create Precisely Scoped Image Pre-Processor

**File:** `src/html/imagePreProcessor.ts` (new file)

```typescript
import { convertResourceToBase64, downloadRemoteImageAsBase64 } from './assetProcessor';
import { REGEX_PATTERNS } from '../constants';
import { HtmlOptions, MarkdownSegment } from '../types';

/**
 * Pre-processes markdown to handle images in image contexts only.
 * Maintains exact current behavior while eliminating dimension pipeline.
 */
export async function preprocessImageResources(markdown: string, options: HtmlOptions): Promise<string> {
    // Split by code blocks to preserve code segments unchanged
    const segments = segmentByCodeBlocks(markdown);

    const processedSegments = await Promise.all(
        segments.map(async (segment) => {
            if (segment.type === 'code') {
                return segment; // Never modify code blocks or inline code
            }

            let content = segment.content;

            if (options.embedImages) {
                // Process Joplin resource images in image contexts only
                content = await processJoplinImageContexts(content);

                // Process remote images in image contexts only
                if (options.downloadRemoteImages) {
                    content = await processRemoteImageContexts(content);
                }
            } else {
                // embedImages=false: strip Joplin resource images, preserve remote images
                content = stripJoplinResourceImagesOnly(content);
            }

            return { ...segment, content };
        })
    );

    return processedSegments.map((seg) => seg.content).join('');
}

/**
 * Split markdown by code blocks using existing regex pattern.
 * Preserves all fenced code blocks and inline code unchanged.
 */
function segmentByCodeBlocks(markdown: string): MarkdownSegment[] {
    const segments: MarkdownSegment[] = [];
    const codeBlockRegex = new RegExp(REGEX_PATTERNS.CODE_BLOCKS.source, REGEX_PATTERNS.CODE_BLOCKS.flags);
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(markdown)) !== null) {
        // Add non-code segment before this code block
        if (match.index > lastIndex) {
            segments.push({
                type: 'text',
                content: markdown.slice(lastIndex, match.index),
            });
        }
        // Add code block segment
        segments.push({
            type: 'code',
            content: match[0],
        });
        lastIndex = codeBlockRegex.lastIndex;
    }

    // Add any remaining non-code segment
    if (lastIndex < markdown.length) {
        segments.push({
            type: 'text',
            content: markdown.slice(lastIndex),
        });
    }

    return segments;
}

/**
 * Process Joplin resources in image contexts only.
 * Targets: ![alt](:/id) and <img src=":/id" ...>
 * Ignores: [link](:/id) and plain text :/id references
 */
async function processJoplinImageContexts(content: string): Promise<string> {
    // ONLY target image contexts - markdown and HTML images
    const markdownImageRegex = /!\[[^\]]*\]\((:\/[a-f0-9]{32})\)/gi;
    const htmlImageRegex = /<img([^>]*src=["'](:\/[a-f0-9]{32})["'][^>]*)>/gi;

    // Collect unique resource URLs from image contexts only
    const markdownMatches = Array.from(content.matchAll(markdownImageRegex));
    const htmlMatches = Array.from(content.matchAll(htmlImageRegex));

    const allResourceUrls = [...markdownMatches.map((m) => m[1]), ...htmlMatches.map((m) => m[2])];
    const uniqueResourceUrls = [...new Set(allResourceUrls)];

    // Process with concurrency and deduplication
    const conversions = uniqueResourceUrls.map(async (resourceUrl) => {
        const resourceId = resourceUrl.substring(2); // Remove ":/"
        // convertResourceToBase64 already validates mime type
        const result = await convertResourceToBase64(resourceId);
        return { resourceUrl, result };
    });

    const results = await Promise.all(conversions);
    const conversionMap = new Map(results.map((r) => [r.resourceUrl, r.result]));

    // Replace in image contexts only, maintaining current error behavior
    let processedContent = content;

    // Process markdown images: ![alt](:/id)
    processedContent = processedContent.replace(markdownImageRegex, (match, resourceUrl) => {
        const result = conversionMap.get(resourceUrl);
        if (result?.startsWith('data:image/')) {
            // Successful conversion
            return match.replace(resourceUrl, result);
        } else if (result?.includes('color: red')) {
            // Failed conversion - replace entire markdown image with error span
            return result;
        }
        return match; // Fallback
    });

    // Process HTML images: <img src=":/id" ...>
    processedContent = processedContent.replace(htmlImageRegex, (match, imgAttrs, resourceUrl) => {
        const result = conversionMap.get(resourceUrl);
        if (result?.startsWith('data:image/')) {
            // Successful conversion
            return match.replace(resourceUrl, result);
        } else if (result?.includes('color: red')) {
            // Failed conversion - replace entire img tag with error span
            return result;
        }
        return match; // Fallback
    });

    return processedContent;
}

/**
 * Process remote images in image contexts only.
 * Targets: ![alt](https://...) and <img src="https://..." ...>
 * Validates Content-Type on fetch, not file extension.
 */
async function processRemoteImageContexts(content: string): Promise<string> {
    // ONLY target image contexts with HTTP/HTTPS URLs
    const markdownImageRegex = /!\[[^\]]*\]\((https?:\/\/[^)]+)\)/gi;
    const htmlImageRegex = /<img([^>]*src=["'](https?:\/\/[^"']+)["'][^>]*)>/gi;

    // Collect unique URLs from image contexts only
    const markdownMatches = Array.from(content.matchAll(markdownImageRegex));
    const htmlMatches = Array.from(content.matchAll(htmlImageRegex));

    const allUrls = [...markdownMatches.map((m) => m[1]), ...htmlMatches.map((m) => m[2])];
    const uniqueUrls = [...new Set(allUrls)];

    // Download with Content-Type validation and concurrency
    const downloads = uniqueUrls.map(async (url) => {
        // downloadRemoteImageAsBase64 should validate Content-Type
        const result = await downloadRemoteImageAsBase64(url);
        return { url, result };
    });

    const results = await Promise.all(downloads);
    const downloadMap = new Map(results.map((r) => [r.url, r.result]));

    // Replace in image contexts, maintaining current failure behavior
    let processedContent = content;

    // Process markdown images: ![alt](https://...)
    processedContent = processedContent.replace(markdownImageRegex, (match, url) => {
        const result = downloadMap.get(url);
        if (result?.startsWith('data:image/')) {
            // Successful download
            return match.replace(url, result);
        } else if (result?.includes('color: red')) {
            // Failed download - replace entire markdown image with error span
            return result;
        }
        return match; // Fallback
    });

    // Process HTML images: <img src="https://..." ...>
    processedContent = processedContent.replace(htmlImageRegex, (match, imgAttrs, url) => {
        const result = downloadMap.get(url);
        if (result?.startsWith('data:image/')) {
            // Successful download
            return match.replace(url, result);
        } else if (result?.includes('color: red')) {
            // Failed download - replace entire img tag with error span
            return result;
        }
        return match; // Fallback
    });

    return processedContent;
}

/**
 * Strip Joplin resource images when embedImages=false.
 * ONLY removes images, preserves links and remote images.
 * Maintains exact current behavior.
 */
function stripJoplinResourceImagesOnly(content: string): string {
    // Remove ONLY Joplin resource images, not links or other references

    // Remove markdown Joplin resource images: ![...](:/id)
    content = content.replace(/!\[[^\]]*\]\(:\/[a-f0-9]{32}\)/gi, '');

    // Remove HTML Joplin resource images: <img src=":/id" ...>
    content = content.replace(/<img[^>]*src=["']:\/[a-f0-9]{32}["'][^>]*>/gi, '');

    // Do NOT remove [links](:/id) or plain text :/id references
    // Do NOT remove remote images

    return content;
}
```

### 2. Ensure Asset Processor Validates Correctly

**File:** `src/html/assetProcessor.ts`

**Verify `convertResourceToBase64` rejects non-images:**

```typescript
export async function convertResourceToBase64(id: string): Promise<string> {
    // ... existing validation ...

    try {
        const rawResource = await joplin.data.get(['resources', id], { fields: ['id', 'mime'] });

        if (!rawResource || !isMinimalJoplinResource(rawResource)) {
            return createResourceError(id, 'could not be found or is not an image.');
        }

        // CRITICAL: Reject non-image resources (PDFs, files, etc.)
        if (!rawResource.mime.toLowerCase().startsWith('image/')) {
            return createResourceError(id, 'could not be found or is not an image.');
        }

        // ... rest of existing implementation ...
    } catch (err) {
        // ... existing error handling ...
    }
}
```

**Verify `downloadRemoteImageAsBase64` validates Content-Type:**

```typescript
async function downloadRemoteImageAsBase64(url: string): Promise<string> {
    try {
        const response = await withTimeout(
            fetch(url, {
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Joplin Plugin)',
                    Accept: 'image/*',
                },
            }),
            CONSTANTS.BASE64_TIMEOUT_MS,
            'Remote image download timeout'
        );

        if (!response.ok) {
            return createRemoteImageError(url, `download failed: ${response.status} ${response.statusText}`);
        }

        // CRITICAL: Validate Content-Type, don't rely on URL extension
        const contentType = response.headers.get('content-type');
        if (!contentType?.startsWith('image/')) {
            return createRemoteImageError(url, `is not an image (Content-Type: ${contentType})`);
        }

        // ... existing processing logic ...
    } catch (err) {
        // Return error span, not original URL (maintains current behavior)
        return createRemoteImageError(url, `download failed: ${err?.message || err}`);
    }
}
```

Also ensure `downloadRemoteImageAsBase64` is exported (or provide an exported wrapper) so the pre-processor can import it.

### 3. Update HTML Renderer (Simplified Flow)

**File:** `src/htmlRenderer.ts`

```diff
 import { SETTINGS } from './constants';
 import { HtmlOptions } from './types';
 import { validateHtmlSettings } from './utils';
 import { createMarkdownItInstance } from './html/markdownSetup';
-import {
-    extractImageDimensions,
-    applyPreservedDimensions,
-    processEmbeddedImages,
-    processRemoteImages,
-    getUserStylesheet,
-} from './html/assetProcessor';
+import { getUserStylesheet } from './html/assetProcessor';
+import { preprocessImageResources } from './html/imagePreProcessor';
 import { postProcessHtml } from './html/domPostProcess';

 export async function processHtmlConversion(selection: string, options?: HtmlOptions): Promise<string> {
   // ... obtain options ...
-  const { processedMarkdown, dimensions, remoteImages } = extractImageDimensions(
-      selection,
-      htmlOptions.embedImages,
-      htmlOptions.downloadRemoteImages
-  );
+  const processedMarkdown = await preprocessImageResources(selection, htmlOptions);

   const md = await createMarkdownItInstance({ debug });
   let html = md.render(processedMarkdown);

-  if (htmlOptions.embedImages) {
-      html = applyPreservedDimensions(html, dimensions, remoteImages);
-      html = await processEmbeddedImages(html, htmlOptions.embedImages);
-      if (htmlOptions.downloadRemoteImages) {
-          html = await processRemoteImages(html, remoteImages);
-      }
-  }
   html = postProcessHtml(html);
   // ... optionally wrap full document ...
 }
```

### 4. Restore Required Dependencies

**File:** `src/types.ts`

```typescript
// Required for code block segmentation
export interface MarkdownSegment {
    type: 'text' | 'code';
    content: string;
}
```

**File:** `src/constants.ts`

````typescript
export const REGEX_PATTERNS = {
    // Required for code block segmentation - keep existing pattern
    CODE_BLOCKS: /(```[\s\S]*?```|`[^`\n]*`|^(?: {4}|\t).+)/gm,
};
````

### 5. Add Comprehensive Regression Tests

**File:** `src/html/imagePreProcessor.test.ts` (new file)

````typescript
describe('preprocessImageResources regression tests', () => {
    it('should preserve code blocks unchanged', async () => {
        const markdown = 'Text\n```\n![test](:/abc123)\n<img src=":/def456">\n```\nMore text';
        const result = await preprocessImageResources(markdown, { embedImages: true });
        // Code block content should be completely unchanged
        expect(result).toContain('![test](:/abc123)');
        expect(result).toContain('<img src=":/def456">');
    });

    it('should preserve inline code unchanged', async () => {
        const markdown = 'Use `![image](:/abc123)` syntax for images';
        const result = await preprocessImageResources(markdown, { embedImages: true });
        // Inline code should be unchanged
        expect(result).toContain('![image](:/abc123)');
    });

    it('should only process images, not links or plain text', async () => {
        const markdown = 'Link: [file](:/abc123)\n![image](:/abc123)\nText with :/abc123';
        // Mock convertResourceToBase64 to return base64 for abc123
        const result = await preprocessImageResources(markdown, { embedImages: true });

        // Link and plain text should be unchanged
        expect(result).toContain('[file](:/abc123)');
        expect(result).toContain('Text with :/abc123');
        // Only the image should be processed
        // expect(result).not.toContain('![image](:/abc123)'); // if successfully converted
    });

    it('should strip only Joplin images when embedImages=false', async () => {
        const markdown = '![joplin](:/abc123)\n[link](:/abc123)\n![remote](https://example.com/img.jpg)';
        const result = await preprocessImageResources(markdown, { embedImages: false });

        // Joplin image should be stripped
        expect(result).not.toContain('![joplin](:/abc123)');
        // Link should be preserved
        expect(result).toContain('[link](:/abc123)');
        // Remote image should be preserved
        expect(result).toContain('![remote](https://example.com/img.jpg)');
    });

    it('should replace failed conversions with error spans', async () => {
        // Mock convertResourceToBase64 to return error span
        const markdown = '![test](:/abc123)';
        // Mock should return '<span style="color: red">Resource ":abc123" error</span>'
        const result = await preprocessImageResources(markdown, { embedImages: true });

        // Should contain error span instead of original markdown
        expect(result).toContain('color: red');
        expect(result).not.toContain('![test](:/abc123)');
    });

    it('should validate Content-Type for remote images', async () => {
        // Mock fetch to return non-image Content-Type
        const markdown = '![remote](https://example.com/file.pdf)';
        // Mock should detect non-image and return error span
        const result = await preprocessImageResources(markdown, { embedImages: true, downloadRemoteImages: true });

        // Should contain error span for invalid content type
        expect(result).toContain('color: red');
    });
});
````

## Key Correctness Guarantees

1. **Precise Scoping** - Only `![...](url)` and `<img src="url">` patterns processed
2. **Code Preservation** - Uses existing `REGEX_PATTERNS.CODE_BLOCKS` segmentation
3. **Resource Type Validation** - Leverages existing mime type checking in `convertResourceToBase64`
4. **Exact embedImages=false Behavior** - Strips only Joplin image contexts, preserves everything else
5. **Content-Type Validation** - No file extension reliance for remote images
6. **Current Failure Semantics** - Error spans replace failed images, not original URLs

## Validation Criteria

- [ ] Code blocks and inline code never modified
- [ ] Links like `[file](:/id)` never processed, only `![img](:/id)`
- [ ] Plain text `:/id` references preserved
- [ ] Non-image resources (PDFs, files) never embedded
- [ ] embedImages=false strips only Joplin images, preserves remote images and links
- [ ] Remote images validated by Content-Type header
- [ ] Failed conversions produce error spans matching current behavior
- [ ] Tests updated: remove dimension pipeline tests, add pre-processor tests
- [ ] Performance improved through concurrency and deduplication

**Result:** A dramatically simplified pipeline that eliminates ~300 lines of dimension complexity while maintaining **exact** behavioral compatibility through precise scoping and validation.
