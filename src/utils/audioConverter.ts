/**
 * Audio Converter Utility
 * Converts blob URLs to data URLs for persistence in database
 */

/**
 * Convert a blob URL to a data URL (base64)
 * This allows audio to persist after page reload
 * 
 * @param blobUrl - The blob URL (blob:http://...)
 * @returns Data URL (data:audio/wav;base64,...)
 */
export async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
    console.log('[AudioConverter] Converting blob URL to data URL...');
    
    try {
        // Fetch the blob data
        const response = await fetch(blobUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch blob: ${response.status}`);
        }
        
        const blob = await response.blob();
        console.log('[AudioConverter] Blob fetched:', blob.size, 'bytes, type:', blob.type);
        
        // Convert blob to data URL using FileReader
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                console.log('[AudioConverter] Conversion complete, data URL length:', dataUrl.length);
                resolve(dataUrl);
            };
            
            reader.onerror = () => {
                console.error('[AudioConverter] FileReader error:', reader.error);
                reject(new Error('Failed to convert blob to data URL'));
            };
            
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('[AudioConverter] Conversion failed:', error);
        throw error;
    }
}

/**
 * Download audio as a file
 * 
 * @param audioUrl - The audio URL (blob or data URL)
 * @param filename - The filename to save as
 * @param mimeType - The MIME type (e.g., 'audio/wav', 'audio/mp3')
 */
export async function downloadAudio(audioUrl: string, filename: string, mimeType: string = 'audio/wav'): Promise<void> {
    console.log('[AudioConverter] Downloading audio:', filename);
    
    try {
        let blobToDownload: Blob;
        
        // If it's a data URL, convert it to blob
        if (audioUrl.startsWith('data:')) {
            const response = await fetch(audioUrl);
            blobToDownload = await response.blob();
        } 
        // If it's a blob URL, fetch it
        else if (audioUrl.startsWith('blob:')) {
            const response = await fetch(audioUrl);
            blobToDownload = await response.blob();
        }
        else {
            throw new Error('Invalid audio URL format');
        }
        
        // Create download link
        const downloadUrl = URL.createObjectURL(blobToDownload);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
        
        console.log('[AudioConverter] Download initiated');
    } catch (error) {
        console.error('[AudioConverter] Download failed:', error);
        throw error;
    }
}

/**
 * Get the audio format from a URL or blob
 * 
 * @param audioUrl - The audio URL
 * @returns Audio format (wav, mp3, etc.)
 */
export function getAudioFormat(audioUrl: string): string {
    if (audioUrl.startsWith('data:')) {
        const match = audioUrl.match(/data:audio\/([^;]+)/);
        return match ? match[1] : 'unknown';
    }
    // Default to wav for blob URLs (most common for our generated audio)
    return 'wav';
}
