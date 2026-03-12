import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Quote, Enquiry, QuoteWithDetails, EnquiryWithDetails } from "@/types/quotes";
import { useDataEnvironment } from "@/hooks/useSandbox";

export const useQuotes = () => {
  const dataEnvironment = useDataEnvironment();
  
  return useQuery({
    queryKey: ["quotes", dataEnvironment],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("data_environment", dataEnvironment)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useEnquiries = () => {
  const dataEnvironment = useDataEnvironment();
  
  return useQuery({
    queryKey: ["enquiries", dataEnvironment],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enquiries")
        .select("*")
        .eq("data_environment", dataEnvironment)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useCreateQuote = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const dataEnvironment = useDataEnvironment();

  return useMutation({
    mutationFn: async (quote: Omit<Quote, "id" | "created_at" | "updated_at" | "quote_number">) => {
      const { data, error } = await supabase
        .from("quotes")
        .insert({ ...quote, data_environment: dataEnvironment })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({
        title: "Quote created successfully",
        description: "The quote has been created and is ready to send.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating quote",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useCreateEnquiry = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const dataEnvironment = useDataEnvironment();

  return useMutation({
    mutationFn: async (enquiry: Omit<Enquiry, "id" | "created_at" | "updated_at" | "enquiry_number">) => {
      const { data, error } = await supabase
        .from("enquiries")
        .insert({ ...enquiry, data_environment: dataEnvironment })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] });
      toast({
        title: "Enquiry created successfully",
        description: "The enquiry has been recorded and can be tracked.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating enquiry",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};