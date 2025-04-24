// Utility script for image processing and Convex upload
import { resizeAndCropToSquare } from './utils/imageProcessing';
import { uploadImageToConvex, deleteImageFromConvex } from './utils/convexApi';

export async function handleImageUpload(file, userId) {
  try {
    const resizedImage = await resizeAndCropToSquare(file, 800);
    const uploadResult = await uploadImageToConvex(resizedImage, userId);
    return uploadResult;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

export async function handleImageDelete(imageId) {
  try {
    await deleteImageFromConvex(imageId);
    return true;
  } catch (error) {
    console.error('Deletion failed:', error);
    return false;
  }
}

