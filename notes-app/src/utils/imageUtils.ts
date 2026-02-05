import type { ImageData } from '../components/ImageGallery';

// Maximum image dimensions
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Compress and convert image to base64
export async function processImage(file: File): Promise<ImageData | null> {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    alert(`Image too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    return null;
  }

  // Check file type
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return null;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        // Create canvas and compress
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 (JPEG for better compression)
        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        
        // Calculate compressed size
        const compressedSize = Math.round((base64.length * 3) / 4);
        
        resolve({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          data: base64,
          name: file.name,
          size: compressedSize,
          type: 'image/jpeg',
          addedAt: new Date().toISOString(),
        });
      };
      
      img.onerror = () => {
        alert('Failed to load image');
        resolve(null);
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      alert('Failed to read file');
      resolve(null);
    };
    
    reader.readAsDataURL(file);
  });
}

// Process multiple images
export async function processImages(files: File[]): Promise<ImageData[]> {
  const results = await Promise.all(files.map(file => processImage(file)));
  return results.filter((img): img is ImageData => img !== null);
}

// Check localStorage usage
export function checkStorageUsage(): { used: number; total: number; percentage: number } {
  let total = 0;
  
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length;
    }
  }
  
  const usedMB = (total / 1024 / 1024).toFixed(2);
  const totalMB = 10; // Approximate localStorage limit
  const percentage = (parseFloat(usedMB) / totalMB) * 100;
  
  return {
    used: parseFloat(usedMB),
    total: totalMB,
    percentage: Math.round(percentage),
  };
}

// Warn if storage is getting full
export function checkStorageWarning(): boolean {
  const { percentage } = checkStorageUsage();
  
  if (percentage > 80) {
    alert(`Storage is ${percentage}% full. Consider archiving or deleting old items with images.`);
    return true;
  }
  
  return false;
}
