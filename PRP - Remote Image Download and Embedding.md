# Plugin Enhancement Request (PER): Add Remote Image Download and Embedding

## Overview

Add functionality to download remote HTTP/HTTPS images and embed them as base64 when copying as HTML, similar to how Joplin resource images are currently handled.

## Current State

The plugin currently:

- ✅ Embeds Joplin resource images (`:/<resource-id>`) as base64
- ✅ Preserves image dimensions from HTML `<img>` tags
- ✅ Has robust error handling and timeout protection
- ❌ Leaves remote HTTP/HTTPS images as external references

## Requirements

### Functional Requirements

1. **New Setting**: Add `downloadRemoteImages` boolean setting (default: false)
2. **Remote Image Detection**: Detect and process `<img src="https://...">` and `![](https://...)` patterns
3. **Download & Embed**: Download remote images and convert to base64 data URIs
4. **Dimension Preservation**: Maintain width/height attributes for remote images
5. **Error Handling**: Display red error spans for failed downloads (don't break operation)
6. **Security**: Validate content-type, apply size limits, use timeout protection

### Non-Functional Requirements

1. **Performance**: Concurrent downloads with existing timeout (5s)
2. **Privacy**: Opt-in only (default disabled)
3. **Security**: Same size limits as Joplin resources (10MB max, 5MB warning)
4. **Consistency**: Use existing error handling patterns and styling

## Implementation Plan

### 1. Settings Extension

**Files**: `src/constants.ts`, `src/types.ts`, `src/index.ts`

```typescript
// constants.ts
export const SETTINGS = {
    // ... existing
    DOWNLOAD_REMOTE_IMAGES: 'downloadRemoteImages',
};

// types.ts  
export interface HtmlOptions {
    embedImages: boolean;
    exportFullHtml: boolean;
    downloadRemoteImages: boolean; // NEW
}

// index.ts - settings registration
[SETTINGS.DOWNLOAD_REMOTE_IMAGES]: {
    value: false,
    type: SettingItemType.Bool,
    section: 'copyAsHtml',
    public: true,
    label: 'Download and embed remote images',
    description: 'If enabled, remote HTTP/HTTPS images will be downloaded and embedded as base64. May impact performance and privacy.',
}
```

### 2. Core Processing Logic

**File**: `src/html/assetProcessor.ts`

#### 2a. Extend Image Detection

```typescript
export interface RemoteImageData {
    originalUrl: string;
    placeholder: string;
    dimensions?: ImageDimensions;
}

export function extractImageDimensions(
    markdown: string,
    embedImages: boolean,
    downloadRemoteImages: boolean = false
): {
    processedMarkdown: string;
    dimensions: Map<string, ImageDimensions>;
    remoteImages: Map<string, RemoteImageData>;
} {
    // ... existing Joplin resource logic ...
    
    // NEW: Remote image processing
    if (downloadRemoteImages && embedImages) {
        const remoteImgRegex = /<img([^>]*src=["'](https?:\/\/[^"']+)["'][^>]*)>/gi;
        processedContent = processedContent.replace(remoteImgRegex, (match, attrs, url) => {
            const placeholder = `REMOTE_${counter}`;
            const widthMatch = attrs.match(/\bwidth\s*=\s*["']?([^"'\s>]+)["']?/i);
            const heightMatch = attrs.match(/\bheight\s*=\s*["']?([^"'\s>]+)["']?/i);
            const altMatch = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i);
            
            remoteImages.set(placeholder, {
                originalUrl: url,
                placeholder,
                dimensions: {
                    width: widthMatch?.[1],
                    height: heightMatch?.[1],
                    resourceId: url, // Use URL as identifier
                    originalAlt: altMatch?.[1] || '',
                }
            });
            
            counter++;
            return `![${placeholder}](${url})`;
        });
    }
    
    return { processedMarkdown, dimensions, remoteImages };
}
```

#### 2b. Remote Download Function

```typescript
async function downloadRemoteImageAsBase64(url: string): Promise<string> {
    try {
        const response = await withTimeout(
            fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Joplin Plugin)',
                    'Accept': 'image/*',
                }
            }),
            CONSTANTS.BASE64_TIMEOUT_MS,
            'Remote image download timeout'
        );

        if (!response.ok) {
            return createResourceError(url, `download failed: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType?.startsWith('image/')) {
            return createResourceError(url, `is not an image (Content-Type: ${contentType})`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length > CONSTANTS.MAX_IMAGE_SIZE_BYTES) {
            return createResourceError(
                url,
                `is too large (${Math.round(buffer.length / 1024 / 1024)}MB). Maximum size: ${Math.round(CONSTANTS.MAX_IMAGE_SIZE_BYTES / 1024 / 1024)}MB`
            );
        }

        if (buffer.length > CONSTANTS.MAX_IMAGE_SIZE_WARNING) {
            console.warn(`[copy-as-html] Large remote image: ${url} is ${Math.round(buffer.length / 1024 / 1024)}MB`);
        }

        const base64 = buffer.toString('base64');
        return `data:${contentType};base64,${base64}`;
        
    } catch (err) {
        console.error('[copy-as-html] Failed to download remote image:', url, err);
        const msg = err?.message || String(err);
        return createResourceError(url, `download failed: ${msg}`);
    }
}
```

#### 2c. Remote Image Processing

```typescript
export async function processRemoteImages(html: string, remoteImages: Map<string, RemoteImageData>): Promise<string> {
    if (remoteImages.size === 0) return html;

    // Process all remote images concurrently
    const downloadPromises = Array.from(remoteImages.entries()).map(async ([placeholder, imageData]) => {
        const base64Result = await downloadRemoteImageAsBase64(imageData.originalUrl);
        return { placeholder, imageData, base64Result };
    });

    const results = await Promise.all(downloadPromises);

    // Apply results to HTML
    for (const { placeholder, imageData, base64Result } of results) {
        if (base64Result.startsWith('data:image')) {
            // Successful download - replace src with base64
            const srcRegex = new RegExp(`src=["']${escapeRegex(imageData.originalUrl)}["']`, 'gi');
            html = html.replace(srcRegex, `src="${base64Result}"`);
        } else {
            // Failed download - replace entire img tag with error span
            const imgRegex = new RegExp(`<img[^>]*src=["']${escapeRegex(imageData.originalUrl)}["'][^>]*>`, 'gi');
            html = html.replace(imgRegex, base64Result);
        }
    }

    return html;
}

// Helper function
function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### 3. Integration

**File**: `src/htmlRenderer.ts`

```typescript
export async function processHtmlConversion(selection: string, options?: HtmlOptions): Promise<string> {
    // 1. Get settings (include downloadRemoteImages)
    const htmlOptions = options || validateHtmlSettings({
        embedImages: await joplin.settings.value(SETTINGS.EMBED_IMAGES),
        exportFullHtml: await joplin.settings.value(SETTINGS.EXPORT_FULL_HTML),
        downloadRemoteImages: await joplin.settings.value(SETTINGS.DOWNLOAD_REMOTE_IMAGES), // NEW
    });

    // 2. Pre-process markdown (now handles remote images)
    const { processedMarkdown, dimensions, remoteImages } = extractImageDimensions(
        selection, 
        htmlOptions.embedImages,
        htmlOptions.downloadRemoteImages // NEW
    );

    // 3. Render markdown
    const md = await createMarkdownItInstance({ debug });
    let html = md.render(processedMarkdown);

    // 4. Post-process assets
    if (htmlOptions.embedImages) {
        html = applyPreservedDimensions(html, dimensions);
        html = await processEmbeddedImages(html, htmlOptions.embedImages);
        
        // NEW: Process remote images
        if (htmlOptions.downloadRemoteImages) {
            html = await processRemoteImages(html, remoteImages);
        }
    }

    // ... rest unchanged
}
```

### 4. Validation Updates

**File**: `src/utils.ts`

```typescript
export function validateHtmlSettings(settings: unknown): HtmlOptions {
    const s = (settings || {}) as Partial<HtmlOptions>;
    return {
        embedImages: validateBooleanSetting(s.embedImages, true),
        exportFullHtml: validateBooleanSetting(s.exportFullHtml, false),
        downloadRemoteImages: validateBooleanSetting(s.downloadRemoteImages, false), // NEW
    };
}
```

## Testing Strategy

### Unit Tests

1. **Remote image detection**: Test regex patterns for various HTML/markdown formats
2. **Download function**: Mock fetch responses (success, 404, non-image, timeout)
3. **Error handling**: Verify error spans are generated correctly
4. **Size limits**: Test oversized image rejection

### Integration Tests

1. **End-to-end**: Mock remote images and verify base64 embedding
2. **Mixed content**: Joplin resources + remote images in same selection
3. **Dimension preservation**: Remote images with width/height attributes
4. **Setting disabled**: Verify remote images left as-is when disabled

### Edge Cases

1. **Invalid URLs**: Malformed HTTP URLs
2. **Redirects**: Following HTTP redirects
3. **Slow responses**: Timeout handling
4. **Mixed protocols**: HTTP vs HTTPS
5. **No internet**: Network failure scenarios

## Error Cases & User Feedback

### Download Failures

- **404 Not Found**: "Remote image https://example.com/missing.jpg download failed: 404 Not Found"
- **Timeout**: "Remote image https://slow.com/image.jpg download failed: Remote image download timeout"
- **Non-image**: "Remote image https://example.com/file.pdf is not an image (Content-Type: application/pdf)"
- **Too large**: "Remote image https://example.com/huge.jpg is too large (15MB). Maximum size: 10MB"

### Success Feedback

- Console warning for large images (>5MB)
- No user-visible feedback for successful downloads (seamless operation)

## Security Considerations

1. **Content-Type Validation**: Only download resources with `image/*` content-type
2. **Size Limits**: Apply same 10MB limit as Joplin resources
3. **Timeout Protection**: Use existing 5-second timeout
4. **Privacy**: Default disabled, clear description about external requests
5. **User-Agent**: Identify as Joplin plugin to remote servers

## Performance Considerations

1. **Concurrent Downloads**: Process multiple remote images in parallel
2. **Early Exit**: Skip processing when no remote images detected
3. **Memory Management**: Use streams for large images if needed
4. **Caching**: No caching (single-use operation)

## Files to Modify

1. `src/constants.ts` - Add setting constant
2. `src/types.ts` - Extend HtmlOptions interface
3. `src/utils.ts` - Update validation function
4. `src/index.ts` - Register new setting
5. `src/html/assetProcessor.ts` - Main implementation (~150 lines)
6. `src/htmlRenderer.ts` - Integration (~5 lines)

## Success Criteria

1. ✅ Remote images are downloaded and embedded as base64 when setting enabled
2. ✅ Image dimensions are preserved for remote images
3. ✅ Failed downloads show red error spans without breaking operation
4. ✅ Setting defaults to disabled for privacy
5. ✅ Performance is acceptable (concurrent downloads, timeouts)
6. ✅ Error handling is consistent with existing patterns
7. ✅ All existing functionality remains unaffected

## Implementation Notes

- Reuse existing infrastructure (timeout utilities, error formatting, regex patterns)
- Follow established naming conventions and code organization
- Maintain separation of concerns (asset processing vs rendering)
- Ensure TypeScript type safety throughout
- Add comprehensive error logging with `[copy-as-html]` prefix