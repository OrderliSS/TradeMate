import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getCurrentEnvironment } from '@/lib/environment-utils';
import { useQueryClient } from '@tanstack/react-query';

export const useDevDataGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [imageGenerationProgress, setImageGenerationProgress] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const cleanupOldDevData = async (): Promise<boolean> => {
    const environment = getCurrentEnvironment();
    
    if (environment !== 'development') {
      toast({
        title: "Error",
        description: "Cleanup can only be run in development environment",
        variant: "destructive",
      });
      return false;
    }

    setIsCleaningUp(true);

    try {
      // Delete vendor shops with timestamps in their names
      const { error: deleteError } = await supabase
        .from("vendor_shops")
        .delete()
        .like('shop_name', '%[%]%');

      if (deleteError) throw deleteError;

      toast({
        title: "Success",
        description: "Old development data with timestamps cleaned up successfully",
      });

      return true;
    } catch (error) {
      console.error('Error cleaning up dev data:', error);
      toast({
        title: "Error",
        description: "Failed to cleanup old development data",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsCleaningUp(false);
    }
  };

  const generateMockData = async (options: {
    generateAssets?: boolean;
    generateContacts?: boolean;
    generateVendors?: boolean;
    generateProducts?: boolean;
    generateProductImages?: boolean;
  } = {}): Promise<boolean> => {
    const {
      generateAssets = false,
      generateContacts = true,
      generateVendors = true,
      generateProducts = true,
      generateProductImages = true
    } = options;
    
    // Critical safety check - only allow in development environment
    if (getCurrentEnvironment() !== 'development') {
      toast({
        title: "Error",
        description: "Mock data can only be generated in development environment",
        variant: "destructive",
      });
      return false;
    }

    setIsGenerating(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      let contactIds: string[] = [];
      let vendorIds: string[] = [];
      let productIds: string[] = [];

      // 1. Generate Contacts (if enabled)
      if (generateContacts) {
        const mockContacts = [
          { name: "John Doe", email: "john.doe@dev.com", phone: "555-0101", relationship_type: "customer", status: "active", assigned_to: currentUserId },
          { name: "Jane Smith", email: "jane.smith@dev.com", phone: "555-0102", relationship_type: "customer", status: "active", assigned_to: currentUserId },
          { name: "Bob Wilson", email: "bob.wilson@dev.com", phone: "555-0103", relationship_type: "client", status: "active", assigned_to: currentUserId },
          { name: "Alice Brown", email: "alice.brown@dev.com", phone: "555-0104", relationship_type: "customer", status: "active", assigned_to: currentUserId },
          { name: "Charlie Green", email: "charlie.green@dev.com", phone: "555-0105", relationship_type: "customer", status: "active", assigned_to: currentUserId }
        ];

        const { data: contacts, error: contactsError } = await (supabase as any)
          .createWithEnvironment('customers', mockContacts)
          .select();

        if (contactsError) {
          console.error('Error creating contacts:', contactsError);
          throw new Error('Failed to create contacts');
        }

        contactIds = contacts.map((c: any) => c.id);
        console.log(`Created ${contacts.length} contacts`);
      }

      // 2. Generate Vendors (if enabled)
      if (generateVendors) {
        const timestamp = Date.now();
        const mockVendors = [
          { 
            shop_name: `Electronics Store [${timestamp}]`, 
            owner_contact_id: contactIds[0] || null,
            category: "Electronics",
            status: "active"
          },
          { 
            shop_name: `Hardware Supply [${timestamp}]`, 
            owner_contact_id: contactIds[1] || null,
            category: "Hardware",
            status: "active"
          },
          { 
            shop_name: `Tech Solutions [${timestamp}]`, 
            owner_contact_id: contactIds[2] || null,
            category: "Technology",
            status: "active"
          }
        ];

        const { data: vendors, error: vendorsError } = await (supabase as any)
          .createWithEnvironment('vendor_shops', mockVendors)
          .select();

        if (vendorsError) {
          console.error('Error creating vendors:', vendorsError);
          throw new Error('Failed to create vendors');
        }

        vendorIds = vendors.map((v: any) => v.id);
        console.log(`Created ${vendors.length} vendors`);
      }

      // 3. Generate Products (if enabled)
      if (generateProducts) {
        const mockProducts = [
          { 
            name: "Laptop Pro 15", 
            sku: `LP15-${Date.now()}`,
            price: 1299.99,
            stock_quantity: 10,
            category: "Electronics",
            status: "active"
          },
          { 
            name: "Wireless Mouse", 
            sku: `WM-${Date.now()}`,
            price: 29.99,
            stock_quantity: 50,
            category: "Accessories",
            status: "active"
          },
          { 
            name: "USB-C Cable 2m", 
            sku: `USBC-${Date.now()}`,
            price: 19.99,
            stock_quantity: 100,
            category: "Cables",
            status: "active"
          },
          { 
            name: "Mechanical Keyboard", 
            sku: `MK-${Date.now()}`,
            price: 149.99,
            stock_quantity: 25,
            category: "Peripherals",
            status: "active"
          },
          { 
            name: "External SSD 1TB", 
            sku: `SSD1TB-${Date.now()}`,
            price: 89.99,
            stock_quantity: 30,
            category: "Storage",
            status: "active"
          }
        ];

        const { data: products, error: productsError } = await (supabase as any)
          .createWithEnvironment('products', mockProducts)
          .select();

        if (productsError) {
          console.error('Error creating products:', productsError);
          throw new Error('Failed to create products');
        }

        productIds = products.map((p: any) => p.id);
        console.log(`Created ${products.length} products`);

        // 4. Generate Product Images (if enabled)
        if (generateProductImages && productIds.length > 0) {
          setImageGenerationProgress('Generating product images...');
          
          for (let i = 0; i < productIds.length; i++) {
            const product = products[i];
            const productId = productIds[i];
            
            setImageGenerationProgress(`Generating image for ${product.name} (${i + 1}/${productIds.length})`);
            
            // Generate image URL placeholder
            const imageUrl = `https://placehold.co/400x300/png?text=${encodeURIComponent(product.name)}`;
            
            // Update product with image
            await (supabase as any)
              .updateWithEnvironment('products', productId, {
                images: [imageUrl]
              });
            
            console.log(`Generated image for product: ${product.name}`);
          }
          
          setImageGenerationProgress(null);
        }
      }

      // 5. Generate Assets (if enabled)
      if (generateAssets && productIds.length > 0) {
        const mockAssets = productIds.slice(0, 3).map((productId, index) => ({
          product_id: productId,
          asset_tag: `AST-${Date.now()}-${index}`,
          serial_number: `SN${Date.now()}${index}`,
          status: 'available',
          location: 'Warehouse A'
        }));

        const { error: assetsError } = await (supabase as any)
          .createWithEnvironment('asset_management', mockAssets);

        if (assetsError) {
          console.error('Error creating assets:', assetsError);
          throw new Error('Failed to create assets');
        }

        console.log(`Created ${mockAssets.length} assets`);
      }

      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["vendor-stores"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-shops"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });

      toast({
        title: "Success",
        description: "Mock data generated successfully for development environment",
      });

      return true;
    } catch (error) {
      console.error('Error generating mock data:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate mock data",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsGenerating(false);
      setImageGenerationProgress(null);
    }
  };

  return {
    generateMockData,
    cleanupOldDevData,
    isGenerating,
    isCleaningUp,
    imageGenerationProgress
  };
};
