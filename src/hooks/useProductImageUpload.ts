import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface UseProductImageUploadProps {
  productId: string;
  currentImages: string[];
  onUpdate: (images: string[]) => Promise<void>;
}

export function useProductImageUpload({ productId, currentImages, onUpdate }: UseProductImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadedUrls = [];
      
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error } = await supabase.storage
          .from('product-images')
          .upload(fileName, file);
          
        if (error) {
          console.error('Upload error:', error);
          continue;
        }
        
        const { data } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
          
        uploadedUrls.push(data.publicUrl);
      }
      
      if (uploadedUrls.length > 0) {
        await onUpdate([...currentImages, ...uploadedUrls]);
        
        toast({
          title: "Images uploaded",
          description: `Successfully added ${uploadedUrls.length} image(s)`,
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async (imageUrl: string, index: number) => {
    if (index === 0) {
      const confirmed = window.confirm('Remove primary image? This will affect how the product is displayed.');
      if (!confirmed) return;
    }
    
    setIsRemoving(true);
    try {
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      
      await supabase.storage
        .from('product-images')
        .remove([fileName]);
      
      const newImages = currentImages.filter((_, i) => i !== index);
      await onUpdate(newImages);
      
      toast({
        title: "Image removed",
        description: "Image successfully deleted",
      });
    } catch (error) {
      console.error('Remove error:', error);
      toast({
        title: "Removal failed",
        description: "Failed to remove image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return {
    isUploading,
    isRemoving,
    handleUpload,
    handleRemove
  };
}
