export const CLOUDINARY_CLOUD_NAME = 'dvfdcdxli';
export const CLOUDINARY_UPLOAD_PRESET = 'avani_unsigned';

/**
 * Uploads an image URI (from camera or gallery) to Cloudinary.
 * @param imageUri Local file URI of the image
 * @returns The secure URL of the uploaded image on Cloudinary, or null if failed.
 */
export async function uploadImageToCloudinary(imageUri: string): Promise<string | null> {
  if (!imageUri) return null;

  try {
    const formData = new FormData();
    
    // Extract filename and type from URI
    const filename = imageUri.split('/').pop() || 'upload.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image/jpeg`;

    // Append to FormData
    formData.append('file', {
      uri: imageUri,
      name: filename,
      type,
    } as any);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    const data = await response.json();
    
    if (data.secure_url) {
      return data.secure_url;
    } else {
      console.error('Cloudinary upload error:', data);
      return null;
    }
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    return null;
  }
}
