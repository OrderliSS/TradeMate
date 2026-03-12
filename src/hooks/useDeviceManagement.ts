/**
 * Device Management Hook - Phase 4
 * Manages multi-device sessions and device fingerprinting
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface UserDevice {
  id: string;
  user_id: string;
  device_fingerprint: string;
  device_name: string | null;
  platform: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
}

interface DeviceInfo {
  fingerprint: string;
  name: string;
  platform: 'web' | 'ios' | 'android' | 'electron' | 'unknown';
  userAgent: string;
}

/**
 * Generate a simple device fingerprint based on browser characteristics
 */
function generateDeviceFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
    (navigator as { deviceMemory?: number }).deviceMemory || 'unknown',
  ];
  
  // Simple hash
  const str = components.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return `fp_${Math.abs(hash).toString(36)}_${Date.now().toString(36).slice(-4)}`;
}

/**
 * Detect platform from user agent
 */
function detectPlatform(): 'web' | 'ios' | 'android' | 'electron' | 'unknown' {
  const ua = navigator.userAgent.toLowerCase();
  
  if (ua.includes('electron')) return 'electron';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (ua.includes('android')) return 'android';
  if (ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari')) return 'web';
  
  return 'unknown';
}

/**
 * Generate a user-friendly device name
 */
function generateDeviceName(): string {
  const platform = detectPlatform();
  const os = navigator.platform || 'Unknown OS';
  
  if (platform === 'electron') return `Desktop App (${os})`;
  if (platform === 'ios') return 'iPhone/iPad';
  if (platform === 'android') return 'Android Device';
  
  // For web, try to get browser name
  const ua = navigator.userAgent;
  if (ua.includes('Chrome')) return `Chrome on ${os}`;
  if (ua.includes('Firefox')) return `Firefox on ${os}`;
  if (ua.includes('Safari')) return `Safari on ${os}`;
  if (ua.includes('Edge')) return `Edge on ${os}`;
  
  return `Browser on ${os}`;
}

const DEVICE_FINGERPRINT_KEY = 'orderli:device_fingerprint';

/**
 * Get or create device fingerprint
 */
function getOrCreateFingerprint(): string {
  const stored = localStorage.getItem(DEVICE_FINGERPRINT_KEY);
  if (stored) return stored;
  
  const fingerprint = generateDeviceFingerprint();
  localStorage.setItem(DEVICE_FINGERPRINT_KEY, fingerprint);
  return fingerprint;
}

export function useDeviceManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  
  // Device info for this session
  const deviceInfo: DeviceInfo = {
    fingerprint: getOrCreateFingerprint(),
    name: generateDeviceName(),
    platform: detectPlatform(),
    userAgent: navigator.userAgent,
  };

  // Fetch user's devices
  const { 
    data: devices, 
    isLoading,
    refetch: refetchDevices,
  } = useQuery({
    queryKey: ['user-devices', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', user.id)
        .is('revoked_at', null)
        .order('last_seen_at', { ascending: false });
      
      if (error) throw error;
      return data as UserDevice[];
    },
    enabled: !!user?.id,
  });

  // Register current device
  const registerDevice = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('register_device', {
        p_device_fingerprint: deviceInfo.fingerprint,
        p_device_name: deviceInfo.name,
        p_platform: deviceInfo.platform,
        p_user_agent: deviceInfo.userAgent,
      });
      
      if (error) throw error;
      return data as string;
    },
    onSuccess: (deviceId) => {
      setCurrentDeviceId(deviceId);
      queryClient.invalidateQueries({ queryKey: ['user-devices'] });
    },
    onError: (error) => {
      console.error('Failed to register device:', error);
    },
  });

  // Revoke a device
  const revokeDevice = useMutation({
    mutationFn: async (deviceId: string) => {
      const { data, error } = await supabase.rpc('revoke_device', {
        p_device_id: deviceId,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Device revoked');
      queryClient.invalidateQueries({ queryKey: ['user-devices'] });
    },
    onError: (error) => {
      toast.error('Failed to revoke device');
      console.error(error);
    },
  });

  // Revoke all other devices
  const revokeOtherDevices = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('revoke_other_devices', {
        p_current_device_fingerprint: deviceInfo.fingerprint,
      });
      
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      toast.success(`Signed out from ${count} other device(s)`);
      queryClient.invalidateQueries({ queryKey: ['user-devices'] });
    },
    onError: (error) => {
      toast.error('Failed to sign out other devices');
      console.error(error);
    },
  });

  // Register device on mount
  useEffect(() => {
    if (user?.id && !currentDeviceId) {
      registerDevice.mutate();
    }
  }, [user?.id]);

  // Update last seen periodically
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      registerDevice.mutate();
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(interval);
  }, [user?.id]);

  const isCurrentDevice = useCallback((device: UserDevice) => {
    return device.device_fingerprint === deviceInfo.fingerprint;
  }, [deviceInfo.fingerprint]);

  return {
    devices: devices || [],
    isLoading,
    currentDeviceId,
    currentDeviceInfo: deviceInfo,
    isCurrentDevice,
    revokeDevice: (deviceId: string) => revokeDevice.mutate(deviceId),
    revokeOtherDevices: () => revokeOtherDevices.mutate(),
    refetchDevices,
    isRevoking: revokeDevice.isPending || revokeOtherDevices.isPending,
  };
}
