import React, { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import { 
  Plus, 
  Server, 
  Trash2, 
  Edit, 
  TestTube,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  ChevronRight,
  Activity,
  DollarSign,
  Hash,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { api, type RelayStation, type CreateRelayStationRequest, type RelayStationToken, type StationInfo, type UserInfo, type StationLogEntry, type LogPaginationResponse, type ConnectionTestResult } from '@/lib/api';

interface RelayStationManagerProps {
  onBack: () => void;
}

type ViewState = 'list' | 'details';

interface DetailViewProps {
  station: RelayStation;
  onBack: () => void;
  onStationUpdated: () => void;
}

interface AddStationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStationAdded: () => void;
}

const AddStationDialog: React.FC<AddStationDialogProps> = ({ open, onOpenChange, onStationAdded }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    api_url: '',
    adapter: 'newapi',
    auth_method: 'bearer_token',
    system_token: '',
    user_id: '',
    enabled: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const stationRequest: CreateRelayStationRequest = {
        ...formData,
        adapter: formData.adapter as any,
        auth_method: formData.auth_method as any,
        adapter_config: undefined,
      };

      await api.addRelayStation(stationRequest);
      onStationAdded();
      onOpenChange(false);
      setFormData({
        name: '',
        description: '',
        api_url: '',
        adapter: 'newapi',
        auth_method: 'bearer_token',
        system_token: '',
        user_id: '',
        enabled: true,
      });
    } catch (error) {
      console.error('Failed to add station:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>添加中转站</DialogTitle>
          <DialogDescription>
            添加一个新的中转站配置
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                站点名称
              </Label>
              <Input
                id="name"
                name="station_name_" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-form-type="other"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="api_url" className="text-right">
                API地址
              </Label>
              <Input
                id="api_url"
                name="api_endpoint_"
                value={formData.api_url}
                onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                className="col-span-3"
                placeholder="https://api.example.com"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-form-type="other"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="adapter" className="text-right">
                适配器类型
              </Label>
              <Select value={formData.adapter} onValueChange={(value) => setFormData({ ...formData, adapter: value })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择适配器类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newapi">NewAPI</SelectItem>
                  <SelectItem value="oneapi">OneAPI</SelectItem>
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="system_token" className="text-right">
                系统令牌
              </Label>
              <Input
                id="system_token"
                name="api_key_"
                type="password"
                value={formData.system_token}
                onChange={(e) => setFormData({ ...formData, system_token: e.target.value })}
                className="col-span-3"
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-form-type="other"
                data-lpignore="true"
                required
              />
            </div>
            {formData.adapter === 'newapi' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="user_id" className="text-right">
                  用户ID
                </Label>
                <Input
                  id="user_id"
                  name="user_identifier_"
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  className="col-span-3"
                  placeholder="NewAPI用户ID"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-form-type="other"
                  required
                />
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                描述
              </Label>
              <Textarea
                id="description"
                name="station_desc_"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="col-span-3"
                placeholder="可选描述"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-form-type="other"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="enabled" className="text-right">
                启用
              </Label>
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              添加站点
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const StationDetailView: React.FC<DetailViewProps> = ({ station, onBack, onStationUpdated }) => {
  const [activeTab, setActiveTab] = useState('info');
  const [initialLoading, setInitialLoading] = useState(true); // For initial data loading
  const [tabLoading, setTabLoading] = useState(false); // For tab-specific loading
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [stationInfo, setStationInfo] = useState<StationInfo | null>(null);
  const [logsPagination, setLogsPagination] = useState<LogPaginationResponse | null>(null);
  const [tokens, setTokens] = useState<RelayStationToken[]>([]);
  const [connectionTest, setConnectionTest] = useState<ConnectionTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<StationLogEntry | null>(null);
  const [showLogDetails, setShowLogDetails] = useState(false);

  // Track which tabs have been loaded to avoid duplicate requests
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Always load basic info and user info on mount
    loadBasicData();
  }, [station.id]);

  useEffect(() => {
    // Load data when tab changes
    handleTabChange(activeTab);
  }, [activeTab]);

  const loadBasicData = async () => {
    setInitialLoading(true);
    setError(null);
    try {
      console.log('Loading basic station data for:', station.id);
      
      // Load station info
      const info = await api.getStationInfo(station.id);
      console.log('Station info loaded:', info);
      setStationInfo(info);

      // Load user info if user_id is available
      if (station.user_id) {
        try {
          const userInfoData = await api.getTokenUserInfo(station.id, station.user_id);
          console.log('User info loaded:', userInfoData);
          setUserInfo(userInfoData);
        } catch (userError) {
          console.error('Failed to load user info:', userError);
          // Don't fail the entire load if only user info fails
        }
      }

      // Test connection
      try {
        const testResult = await api.testStationConnection(station.id);
        console.log('Connection test result:', testResult);
        setConnectionTest(testResult);
      } catch (testError) {
        console.error('Failed to test connection:', testError);
        setConnectionTest({ success: false, message: `Connection test failed: ${testError}` });
      }

      setLoadedTabs(prev => new Set(prev).add('info'));
    } catch (error) {
      console.error('Failed to load basic station data:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`加载站点数据失败: ${errorMessage}`);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleTabChange = async (tabValue: string) => {
    if (loadedTabs.has(tabValue)) {
      return; // Data already loaded
    }

    // Set loading state only for the specific tab
    setTabLoading(true);
    try {
      switch (tabValue) {
        case 'tokens':
          console.log('Loading tokens for tab switch');
          const tokensData = await api.listStationTokens(station.id);
          console.log('Tokens loaded:', tokensData);
          setTokens(tokensData);
          break;

        case 'logs':
          console.log('Loading logs for tab switch');
          const logsData = await api.getStationLogs(station.id, 1, 10);
          console.log('Logs loaded:', logsData);
          setLogsPagination(logsData);
          break;

        case 'settings':
          // No additional data needed for settings tab
          break;

        default:
          console.warn(`Unknown tab: ${tabValue}`);
          break;
      }

      setLoadedTabs(prev => new Set(prev).add(tabValue));
    } catch (error) {
      console.error(`Failed to load data for tab ${tabValue}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      // You could set a specific error state for tabs if needed
      console.error(`Tab ${tabValue} error:`, errorMessage);
    } finally {
      setTabLoading(false);
    }
  };

  const loadLogsPage = async (page: number, pageSize: number = 10) => {
    setTabLoading(true);
    try {
      const logsData = await api.getStationLogs(station.id, page, pageSize);
      setLogsPagination(logsData);
    } catch (error) {
      console.error('Failed to load logs page:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      // You could show a toast/alert here if needed
      console.error(`Logs page ${page} error:`, errorMessage);
    } finally {
      setTabLoading(false);
    }
  };

  const handleLogClick = (log: StationLogEntry) => {
    setSelectedLog(log);
    setShowLogDetails(true);
  };

  // Format quota as USD price
  const formatPrice = (quota: number | undefined): string => {
    if (!quota) return '$0.00';
    const quotaPerUnit = stationInfo?.quota_per_unit || 500000; // Default to 500000 if not available
    const price = quota / quotaPerUnit;
    return `$${price.toFixed(4)}`;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{station.name}</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={async () => {
                  if (station.api_url) {
                    try {
                      await open(station.api_url);
                    } catch (error) {
                      console.error('Failed to open URL in browser:', error);
                      // Fallback to window.open if Tauri fails
                      window.open(station.api_url, '_blank');
                    }
                  }
                }}
                className="hover:bg-primary/10 p-1"
                title="在浏览器中打开站点"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-muted-foreground">{station.description || '无描述'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={station.enabled ? 'default' : 'secondary'}>
            {station.enabled ? '已启用' : '已禁用'}
          </Badge>
          <Badge variant="outline">{station.adapter}</Badge>
        </div>
      </div>

      {initialLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">加载站点数据...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">加载失败</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={loadBasicData} variant="outline">
                重试
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Info Cards */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">剩余额度</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${userInfo?.balance_remaining?.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">
                  可用余额
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">已用额度</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${userInfo?.amount_used?.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">
                  累计使用
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">请求次数</CardTitle>
                <Hash className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {userInfo?.request_count?.toLocaleString() || '0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  总请求数
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs for detailed info */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info">站点信息</TabsTrigger>
                <TabsTrigger value="tokens">令牌管理</TabsTrigger>
                <TabsTrigger value="logs">使用日志</TabsTrigger>
                <TabsTrigger value="settings">设置</TabsTrigger>
              </TabsList>
              
              <TabsContent value="info" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>站点基本信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">API地址</Label>
                        <p className="text-sm text-muted-foreground">{station.api_url}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">版本</Label>
                        <p className="text-sm text-muted-foreground">{stationInfo?.version || '未知'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">用户名</Label>
                        <p className="text-sm text-muted-foreground">{userInfo?.username || '未知'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">状态</Label>
                        <div className="flex items-center gap-2">
                          {connectionTest?.success ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm text-muted-foreground">
                            {connectionTest?.success ? '连接正常' : '连接异常'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {stationInfo?.announcement && (
                      <div>
                        <Label className="text-sm font-medium">站点公告</Label>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {stationInfo.announcement}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tokens" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>令牌管理</CardTitle>
                    <CardDescription>管理该站点的访问令牌</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {tabLoading && activeTab === 'tokens' ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="ml-2">加载令牌数据...</span>
                      </div>
                    ) : tokens.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">暂无令牌</p>
                    ) : (
                      <div className="space-y-4">
                        {tokens.map((token) => (
                          <div key={token.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                              <h4 className="font-medium">{token.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {token.token.substring(0, 20)}...
                              </p>
                            </div>
                            <Badge variant={token.enabled ? 'default' : 'secondary'}>
                              {token.enabled ? '已启用' : '已禁用'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logs" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>使用日志</CardTitle>
                    <CardDescription>
                      API调用记录 {logsPagination && `(共 ${logsPagination.total} 条)`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {tabLoading && activeTab === 'logs' ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="ml-2">加载日志数据...</span>
                      </div>
                    ) : !logsPagination || logsPagination.items.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">暂无日志</p>
                    ) : (
                      <div className="space-y-4">
                        {/* Log entries */}
                        <div className="space-y-2">
                          {logsPagination.items.map((log) => (
                            <div 
                              key={log.id} 
                              className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/30 hover:border-primary/20 cursor-pointer transition-all duration-200 group"
                              onClick={() => handleLogClick(log)}
                            >
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="text-xs font-mono bg-primary/5 px-2 py-0.5">
                                    {log.model_name || 'unknown'}
                                  </Badge>
                                  <Badge variant={log.level === 'error' ? 'destructive' : log.level === 'warn' ? 'secondary' : 'default'} className="text-xs px-2 py-0.5">
                                    {log.level}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(log.timestamp * 1000).toLocaleString()}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  <div className="bg-muted/40 px-2 py-1.5 rounded text-center">
                                    <span className="text-xs text-muted-foreground block">提示</span>
                                    <span className="text-sm font-mono font-medium">{log.prompt_tokens || 0}</span>
                                  </div>
                                  <div className="bg-muted/40 px-2 py-1.5 rounded text-center">
                                    <span className="text-xs text-muted-foreground block">补全</span>
                                    <span className="text-sm font-mono font-medium">{log.completion_tokens || 0}</span>
                                  </div>
                                  <div className="bg-green-50 dark:bg-green-950/20 px-2 py-1.5 rounded text-center">
                                    <span className="text-xs text-muted-foreground block">花费</span>
                                    <span className="text-sm font-mono font-medium text-green-600 dark:text-green-400">{formatPrice(log.quota)}</span>
                                  </div>
                                  <div className="bg-muted/40 px-2 py-1.5 rounded text-center">
                                    <span className="text-xs text-muted-foreground block">耗时</span>
                                    <span className="text-sm font-mono font-medium">{log.use_time || 0}s</span>
                                  </div>
                                </div>
                                {log.group && (
                                  <div className="text-xs text-muted-foreground bg-muted/20 px-2 py-0.5 rounded inline-block">
                                    分组: {log.group}
                                  </div>
                                )}
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors ml-3 mt-1" />
                            </div>
                          ))}
                        </div>

                        {/* Pagination controls */}
                        {logsPagination.total > logsPagination.page_size && (
                          <div className="flex items-center justify-between pt-6 border-t border-border/50">
                            <div className="text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
                              显示 {(logsPagination.page - 1) * logsPagination.page_size + 1} - {Math.min(logsPagination.page * logsPagination.page_size, logsPagination.total)} 
                              条，共 {logsPagination.total} 条
                            </div>
                            <div className="flex items-center gap-3">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={logsPagination.page <= 1}
                                onClick={() => loadLogsPage(logsPagination.page - 1)}
                                className="hover:bg-primary/10"
                              >
                                上一页
                              </Button>
                              <div className="px-3 py-1 bg-primary/10 rounded-lg text-sm font-medium">
                                {logsPagination.page} / {Math.ceil(logsPagination.total / logsPagination.page_size)}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={logsPagination.page >= Math.ceil(logsPagination.total / logsPagination.page_size)}
                                onClick={() => loadLogsPage(logsPagination.page + 1)}
                                className="hover:bg-primary/10"
                              >
                                下一页
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Log Details Dialog */}
                <Dialog open={showLogDetails} onOpenChange={setShowLogDetails}>
                  <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="pb-4">
                      <DialogTitle className="text-xl">API调用详情</DialogTitle>
                      <DialogDescription className="text-base">
                        {selectedLog && new Date(selectedLog.timestamp * 1000).toLocaleString()}
                      </DialogDescription>
                    </DialogHeader>
                    {selectedLog && (
                      <div className="space-y-3">
                        {/* Basic Info - Compact Table Layout */}
                        <div className="bg-muted/30 rounded-lg p-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-base font-medium">模型</Label>
                              <p className="text-base text-muted-foreground font-mono antialiased">{selectedLog.model_name || 'unknown'}</p>
                            </div>
                            <div>
                              <Label className="text-base font-medium">令牌</Label>
                              <p className="text-base text-muted-foreground font-mono truncate antialiased" title={selectedLog.token_name ? String(selectedLog.token_name) : 'unknown'}>{selectedLog.token_name || 'unknown'}</p>
                            </div>
                            <div>
                              <Label className="text-base font-medium">分组</Label>
                              <p className="text-base text-muted-foreground font-mono antialiased">{selectedLog.group || 'default'}</p>
                            </div>
                            <div>
                              <Label className="text-base font-medium">通道</Label>
                              <p className="text-base text-muted-foreground font-mono truncate antialiased" title={selectedLog.channel ? String(selectedLog.channel) : 'unknown'}>{selectedLog.channel || 'unknown'}</p>
                            </div>
                            <div>
                              <Label className="text-base font-medium">提示令牌</Label>
                              <p className="text-base text-muted-foreground font-mono antialiased">{selectedLog.prompt_tokens || 0}</p>
                            </div>
                            <div>
                              <Label className="text-base font-medium">补全令牌</Label>
                              <p className="text-base text-muted-foreground font-mono antialiased">{selectedLog.completion_tokens || 0}</p>
                            </div>
                            <div>
                              <Label className="text-base font-medium">花费</Label>
                              <p className="text-base text-green-600 dark:text-green-400 font-mono antialiased">{formatPrice(selectedLog.quota)}</p>
                            </div>
                            <div>
                              <Label className="text-base font-medium">响应时间</Label>
                              <p className="text-base text-muted-foreground font-mono antialiased">{selectedLog.use_time || 0}s</p>
                            </div>
                            <div className="col-span-2">
                              <Label className="text-base font-medium">流式传输</Label>
                              <p className="text-base text-muted-foreground font-mono antialiased">{selectedLog.is_stream ? '是' : '否'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Raw Data */}
                        {selectedLog.metadata?.raw && (
                          <div className="space-y-2">
                            <Label className="text-base font-medium text-muted-foreground">原始数据</Label>
                            <div className="relative">
                              <div className="border rounded-lg bg-muted/30 w-full overflow-hidden">
                                <div className="h-80 overflow-auto w-full">
                                  <pre className="p-3 text-sm font-mono whitespace-pre-wrap break-all overflow-wrap-anywhere w-full antialiased subpixel-antialiased">{JSON.stringify(selectedLog.metadata.raw, null, 2)}</pre>
                                </div>
                              </div>
                              <div className="absolute top-2 right-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(JSON.stringify(selectedLog.metadata?.raw, null, 2));
                                    } catch (error) {
                                      console.error('Failed to copy to clipboard:', error);
                                      // Fallback: create a temporary textarea
                                      const textarea = document.createElement('textarea');
                                      textarea.value = JSON.stringify(selectedLog.metadata?.raw, null, 2);
                                      document.body.appendChild(textarea);
                                      textarea.select();
                                      document.execCommand('copy');
                                      document.body.removeChild(textarea);
                                    }
                                  }}
                                  className="h-7 w-7 p-0 bg-muted/80 hover:bg-muted opacity-70 hover:opacity-100"
                                  title="复制到剪贴板"
                                >
                                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Additional Metrics */}
                        {selectedLog.metadata?.other && (
                          <div className="space-y-2">
                            <Label className="text-base font-medium text-muted-foreground">性能指标</Label>
                            <div className="relative">
                              <div className="border rounded-lg bg-muted/30 w-full overflow-hidden">
                                <div className="h-80 overflow-auto w-full">
                                  <pre className="p-3 text-sm font-mono whitespace-pre-wrap break-all overflow-wrap-anywhere w-full antialiased subpixel-antialiased">{JSON.stringify(selectedLog.metadata.other, null, 2)}</pre>
                                </div>
                              </div>
                              <div className="absolute top-2 right-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(JSON.stringify(selectedLog.metadata?.other, null, 2));
                                    } catch (error) {
                                      console.error('Failed to copy to clipboard:', error);
                                      // Fallback: create a temporary textarea
                                      const textarea = document.createElement('textarea');
                                      textarea.value = JSON.stringify(selectedLog.metadata?.other, null, 2);
                                      document.body.appendChild(textarea);
                                      textarea.select();
                                      document.execCommand('copy');
                                      document.body.removeChild(textarea);
                                    }
                                  }}
                                  className="h-7 w-7 p-0 bg-muted/80 hover:bg-muted opacity-70 hover:opacity-100"
                                  title="复制到剪贴板"
                                >
                                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 002 2z" />
                                  </svg>
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>站点设置</CardTitle>
                    <CardDescription>修改站点配置</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={onStationUpdated}>
                          <Edit className="h-4 w-4 mr-2" />
                          编辑配置
                        </Button>
                        <Button variant="outline" onClick={loadBasicData}>
                          <TestTube className="h-4 w-4 mr-2" />
                          测试连接
                        </Button>
                      </div>
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-medium text-destructive mb-2">危险操作</h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          删除此中转站将永久移除所有相关配置和令牌，此操作不可撤销。
                        </p>
                        <Button 
                          variant="destructive" 
                          onClick={() => {
                            const confirmDelete = window.confirm(
                              `确定要删除中转站 "${station.name}" 吗？此操作不可撤销，将删除所有相关配置和令牌。`
                            );
                            
                            if (confirmDelete) {
                              api.deleteRelayStation(station.id).then(() => {
                                onBack();
                                onStationUpdated();
                              }).catch((error) => {
                                console.error('Failed to delete station:', error);
                                alert('删除中转站失败，请稍后重试。');
                              });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除中转站
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
};

const RelayStationManager: React.FC<RelayStationManagerProps> = ({ onBack }) => {
  const [stations, setStations] = useState<RelayStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [viewState, setViewState] = useState<ViewState>('list');
  const [selectedStation, setSelectedStation] = useState<RelayStation | null>(null);

  useEffect(() => {
    loadStations();
  }, []);

  const loadStations = async () => {
    try {
      setLoading(true);
      const stationsData = await api.listRelayStations();
      setStations(stationsData);
    } catch (error) {
      console.error('Failed to load stations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStationClick = (station: RelayStation) => {
    setSelectedStation(station);
    setViewState('details');
  };

  const handleBackToList = () => {
    setViewState('list');
    setSelectedStation(null);
  };


  if (viewState === 'details' && selectedStation) {
    return (
      <StationDetailView
        station={selectedStation}
        onBack={handleBackToList}
        onStationUpdated={loadStations}
      />
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">中转站管理</h2>
            <p className="text-muted-foreground">管理Claude API中转站配置</p>
          </div>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          添加中转站
        </Button>
      </div>

      {/* Station List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : stations.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">暂无中转站</h3>
            <p className="text-muted-foreground mb-4">
              添加您的第一个中转站以开始使用
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              添加中转站
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {stations.map((station) => (
            <Card key={station.id} className="cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{station.name}</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant={station.enabled ? 'default' : 'secondary'}>
                      {station.enabled ? '已启用' : '已禁用'}
                    </Badge>
                    <Badge variant="outline">{station.adapter}</Badge>
                  </div>
                </div>
                <CardDescription>{station.description || '无描述'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <span className="font-medium">API地址: </span>
                    <span className="truncate">{station.api_url}</span>
                  </div>
                  {station.user_id && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span className="font-medium">用户ID: </span>
                      <span>{station.user_id}</span>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => handleStationClick(station)}
                >
                  查看详情
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Add Station Dialog */}
      <AddStationDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onStationAdded={() => {
          loadStations();
          setShowAddDialog(false);
        }}
      />
    </div>
  );
};

export { RelayStationManager };