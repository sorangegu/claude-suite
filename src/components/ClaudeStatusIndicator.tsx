import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertCircle, 
  RefreshCw,
  Settings,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
} from "@/components/ui/popover";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

// Global state to prevent multiple simultaneous checks
let isChecking = false;

// Cache management for persistent status memory
const CACHE_KEY = 'claude_status_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours - much longer cache

interface CachedStatus {
  statusInfo: StatusInfo;
  timestamp: number;
}

const loadCachedStatus = (): StatusInfo | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { statusInfo, timestamp }: CachedStatus = JSON.parse(cached);
      const age = Date.now() - timestamp;
      
      // Use cache if it's within 24 hours, regardless of status
      // This prevents frequent re-checking
      if (age < CACHE_DURATION) {
        // Convert lastChecked back to Date object
        if (statusInfo.lastChecked) {
          statusInfo.lastChecked = new Date(statusInfo.lastChecked);
        }
        console.log('Using cached Claude status, age:', Math.round(age / 1000 / 60), 'minutes');
        return statusInfo;
      }
    }
  } catch (error) {
    console.warn('Failed to load cached Claude status:', error);
  }
  return null;
};

const saveCachedStatus = (statusInfo: StatusInfo) => {
  try {
    // Cache all status types to prevent frequent re-checking
    const cached: CachedStatus = {
      statusInfo,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    console.log('Cached Claude status:', statusInfo.status);
  } catch (error) {
    console.warn('Failed to save Claude status cache:', error);
  }
};

interface ClaudeStatusIndicatorProps {
  className?: string;
  onSettingsClick?: () => void;
}

type ConnectionStatus = 'checking' | 'connected' | 'disconnected' | 'error';

interface StatusInfo {
  status: ConnectionStatus;
  version?: string;
  error?: string;
  lastChecked?: Date;
}

export const ClaudeStatusIndicator: React.FC<ClaudeStatusIndicatorProps> = ({
  className,
  onSettingsClick
}) => {
  const { t } = useTranslation();
  const [statusInfo, setStatusInfo] = useState<StatusInfo>({
    status: 'checking'
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Try to use cached status first - this is the primary mechanism
    const cachedStatus = loadCachedStatus();
    if (cachedStatus) {
      setStatusInfo(cachedStatus);
      console.log('Using cached status, skipping check');
      return; // Use cache, no need to check - this is the key optimization
    }
    
    // Only check if no cache available and not already checking
    if (!isChecking) {
      console.log('No cache available, performing initial check');
      checkClaudeStatus();
    }
  }, []);

  // Listen for custom events to trigger actions
  useEffect(() => {
    const handleOpenSettings = () => {
      onSettingsClick?.();
    };

    const handleValidateInstallation = () => {
      checkClaudeStatus();
    };

    window.addEventListener('open-claude-settings', handleOpenSettings);
    window.addEventListener('validate-claude-installation', handleValidateInstallation);

    return () => {
      window.removeEventListener('open-claude-settings', handleOpenSettings);
      window.removeEventListener('validate-claude-installation', handleValidateInstallation);
    };
  }, [onSettingsClick]);

  // Simple one-time check without retry logic
  const checkClaudeStatus = async () => {
    if (isChecking) return; // Prevent multiple simultaneous checks
    
    try {
      isChecking = true;
      const checkingStatus = { status: 'checking' as const };
      setStatusInfo(checkingStatus);
      
      // Direct API call without retry wrapper
      const versionStatus = await api.checkClaudeVersion();
      
      const newStatus = {
        status: versionStatus.is_installed ? 'connected' as const : 'disconnected' as const,
        version: versionStatus.version,
        error: versionStatus.is_installed ? undefined : 'Claude CLI not found',
        lastChecked: new Date()
      };
      
      // Update local state
      setStatusInfo(newStatus);
      
      // Save to cache for future sessions (24 hour cache)
      saveCachedStatus(newStatus);
      console.log('Claude status check completed:', newStatus.status);
    } catch (error) {
      console.error('Failed to check Claude status:', error);
      const errorStatus = {
        status: 'error' as const,
        error: 'Status check failed',
        lastChecked: new Date()
      };
      setStatusInfo(errorStatus);
      // Cache error status too to prevent constant retrying
      saveCachedStatus(errorStatus);
    } finally {
      isChecking = false;
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Clear cache to force a fresh check
    localStorage.removeItem(CACHE_KEY);
    await checkClaudeStatus();
    setIsRefreshing(false);
  };

  const getStatusIcon = () => {
    switch (statusInfo.status) {
      case 'checking':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'disconnected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (statusInfo.status) {
      case 'checking':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'connected':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'disconnected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'error':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusText = () => {
    switch (statusInfo.status) {
      case 'checking':
        return t('claude.status.checking');
      case 'connected':
        return t('claude.status.connected');
      case 'disconnected':
        return t('claude.status.disconnected');
      case 'error':
        return t('claude.status.error');
      default:
        return t('claude.status.unknown');
    }
  };

  const formatLastChecked = () => {
    if (!statusInfo.lastChecked) return '';
    return statusInfo.lastChecked.toLocaleTimeString();
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <TooltipProvider>
        <Popover
          trigger={
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs font-medium"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2"
              >
                {getStatusIcon()}
                <span className="hidden sm:inline">{getStatusText()}</span>
                {statusInfo.version && (
                  <Badge variant="secondary" className={cn("text-xs", getStatusColor())}>
                    v{statusInfo.version}
                  </Badge>
                )}
              </motion.div>
            </Button>
          }
          content={
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">{t('claude.status.title')}</h4>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="h-6 w-6 p-0"
                      >
                        <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('claude.status.refresh')}</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  {onSettingsClick && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={onSettingsClick}
                          className="h-6 w-6 p-0"
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('claude.status.settings')}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Status Details */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('claude.status.connection')}:
                  </span>
                  <Badge className={cn("text-xs", getStatusColor())}>
                    {getStatusText()}
                  </Badge>
                </div>

                {statusInfo.version && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {t('claude.status.version')}:
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {statusInfo.version}
                    </Badge>
                  </div>
                )}

                {statusInfo.lastChecked && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {t('claude.status.lastChecked')}:
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatLastChecked()}
                    </span>
                  </div>
                )}
              </div>

              {/* Simple Error Information */}
              <AnimatePresence>
                {statusInfo.error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3 bg-destructive/10 border border-destructive/20 rounded-md"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-destructive">
                          {t('claude.status.errorTitle')}
                        </p>
                        <p className="text-xs text-destructive/80 mt-1">
                          {statusInfo.error}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Help Information */}
              {statusInfo.status === 'disconnected' && (
                <div className="p-3 bg-muted rounded-md">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {t('claude.status.helpTitle')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('claude.status.helpText')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          }
          align="start"
          className="w-80 p-4"
        />
      </TooltipProvider>
    </div>
  );
};