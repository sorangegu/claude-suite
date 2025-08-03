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
  ExternalLink,
  Power,
  PowerOff,
  Calendar,
  Users,
  Copy,
  Filter,
  RotateCcw,
  PlayCircle,
  Eye,
  EyeOff,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { api, type RelayStation, type RelayStationAdapter, type CreateRelayStationRequest, type RelayStationToken, type StationInfo, type UserInfo, type StationLogEntry, type LogPaginationResponse, type ConnectionTestResult, type CreateTokenRequest, type UpdateTokenRequest, type TokenGroup } from '@/lib/api';
import { Toast } from '@/components/ui/toast';

interface RelayStationManagerProps {
  onBack: () => void;
}

type ViewState = 'list' | 'details';

interface TokenDetailViewProps {
  token: RelayStationToken;
  station: RelayStation;
  onBack: () => void;
  onTokenUpdated: () => void;
}

interface AddTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  station: RelayStation;
  onTokenAdded: () => void;
}

type TokenViewState = 'list' | 'details';

interface DetailViewProps {
  station: RelayStation;
  onBack: () => void;
  onStationUpdated: () => void;
}

interface AddStationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStationAdded: () => void;
  editMode?: boolean;
  editStation?: RelayStation;
}

const AddTokenDialog: React.FC<AddTokenDialogProps> = ({ open, onOpenChange, station, onTokenAdded }) => {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<TokenGroup[]>([]);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    group: '',
    remain_quota: 0,
    expired_time: -1,
    unlimited_quota: true,
    enabled: true,
  });

  useEffect(() => {
    if (open) {
      loadGroups();
    }
  }, [open, station.id]);

  const loadGroups = async () => {
    try {
      console.log('Loading groups for station:', station.id);
      const groupsData = await api.getUserTokenGroups(station.id);
      console.log('Groups loaded:', groupsData);
      setGroups(groupsData);
    } catch (error) {
      console.error('Failed to load token groups:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tokenRequest: CreateTokenRequest = {
        ...formData,
        group: formData.group === '__no_group__' ? undefined : formData.group || undefined,
        expired_time: formData.expired_time === -1 ? -1 : formData.expired_time,
        remain_quota: formData.unlimited_quota ? undefined : formData.remain_quota,
      };

      await api.addStationToken(station.id, tokenRequest);
      onTokenAdded();
      onOpenChange(false);
      setFormData({
        name: '',
        group: '',
        remain_quota: 0,
        expired_time: -1,
        unlimited_quota: true,
        enabled: true,
      });
    } catch (error) {
      console.error('Failed to add token:', error);
      setToastMessage({ 
        message: '添加令牌失败，请检查输入信息并稍后重试。', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>添加令牌</DialogTitle>
          <DialogDescription>
            为 {station.name} 添加一个新的令牌
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="token_name" className="text-right">
                令牌名称
              </Label>
              <Input
                id="token_name"
                name="token_name_"
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
              <Label htmlFor="token_group" className="text-right">
                分组
              </Label>
              <Select value={formData.group || '__no_group__'} onValueChange={(value) => setFormData({ ...formData, group: value === '__no_group__' ? '' : value })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择分组（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__no_group__">无分组</SelectItem>
                  {groups.map((group) => {
                    console.log('Rendering group option:', group);
                    return (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}{group.description && ` (${group.description})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="unlimited_quota" className="text-right">
                不限额度
              </Label>
              <Switch
                id="unlimited_quota"
                checked={formData.unlimited_quota}
                onCheckedChange={(checked) => setFormData({ ...formData, unlimited_quota: checked })}
              />
            </div>

            {!formData.unlimited_quota && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="remain_quota" className="text-right">
                  额度限制
                </Label>
                <Input
                  id="remain_quota"
                  name="quota_limit_"
                  type="number"
                  value={formData.remain_quota}
                  onChange={(e) => setFormData({ ...formData, remain_quota: parseInt(e.target.value) || 0 })}
                  className="col-span-3"
                  autoComplete="off"
                  min="0"
                  step="1000"
                  placeholder="请输入额度限制"
                />
              </div>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="never_expire" className="text-right">
                永不过期
              </Label>
              <Switch
                id="never_expire"
                checked={formData.expired_time === -1}
                onCheckedChange={(checked) => setFormData({ ...formData, expired_time: checked ? -1 : Date.now() + 30 * 24 * 60 * 60 * 1000 })}
              />
            </div>

            {formData.expired_time !== -1 && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="expired_time" className="text-right">
                  过期时间
                </Label>
                <Input
                  id="expired_time"
                  name="expire_date_"
                  type="datetime-local"
                  value={new Date(formData.expired_time).toISOString().slice(0, 16)}
                  onChange={(e) => setFormData({ ...formData, expired_time: new Date(e.target.value).getTime() })}
                  className="col-span-3"
                  autoComplete="off"
                />
              </div>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="token_enabled" className="text-right">
                启用
              </Label>
              <Switch
                id="token_enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              添加令牌
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto">
            <Toast
              message={toastMessage.message}
              type={toastMessage.type}
              onDismiss={() => setToastMessage(null)}
            />
          </div>
        </div>
      )}
    </Dialog>
  );
};

const AddStationDialog: React.FC<AddStationDialogProps> = ({ 
  open, 
  onOpenChange, 
  onStationAdded, 
  editMode = false, 
  editStation 
}) => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: editMode && editStation ? editStation.name : '',
    description: editMode && editStation ? editStation.description || '' : '',
    api_url: editMode && editStation ? editStation.api_url : '',
    adapter: editMode && editStation ? editStation.adapter : 'newapi',
    auth_method: editMode && editStation ? editStation.auth_method : 'bearer_token',
    system_token: editMode && editStation ? editStation.system_token : '',
    user_id: editMode && editStation ? editStation.user_id || '' : '',
    enabled: editMode && editStation ? editStation.enabled : true,
  });

  // Reset form data when opening/closing or switching edit mode
  useEffect(() => {
    if (open) {
      setShowPassword(false); // Reset password visibility when dialog opens
      setFormData({
        name: editMode && editStation ? editStation.name : '',
        description: editMode && editStation ? editStation.description || '' : '',
        api_url: editMode && editStation ? editStation.api_url : '',
        adapter: editMode && editStation ? editStation.adapter : 'newapi',
        auth_method: editMode && editStation ? editStation.auth_method : 'bearer_token',
        system_token: editMode && editStation ? editStation.system_token : '',
        user_id: editMode && editStation ? editStation.user_id || '' : '',
        enabled: editMode && editStation ? editStation.enabled : true,
      });
    }
  }, [open, editMode, editStation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editMode && editStation) {
        // Update existing station
        const updates = {
          name: formData.name,
          description: formData.description || undefined,
          api_url: formData.api_url,
          adapter: formData.adapter,
          auth_method: formData.auth_method,
          system_token: formData.system_token,
          user_id: formData.user_id || undefined,
          enabled: formData.enabled,
        };

        await api.updateRelayStation(editStation.id, updates);
      } else {
        // Create new station
        const stationRequest: CreateRelayStationRequest = {
          ...formData,
          adapter: formData.adapter as any,
          auth_method: formData.auth_method as any,
          adapter_config: undefined,
        };

        await api.addRelayStation(stationRequest);
      }
      
      onStationAdded();
      onOpenChange(false);
      
      // Only reset form if not in edit mode
      if (!editMode) {
        setShowPassword(false);
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
      }
    } catch (error) {
      console.error(editMode ? 'Failed to update station:' : 'Failed to add station:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editMode ? '编辑中转站' : '添加中转站'}</DialogTitle>
          <DialogDescription>
            {editMode ? '编辑中转站配置' : '添加一个新的中转站配置'}
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
                中转站类型
              </Label>
              <Select value={formData.adapter} onValueChange={(value) => setFormData({ ...formData, adapter: value as RelayStationAdapter })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择中转站类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newapi">NewAPI (完整功能)</SelectItem>
                  <SelectItem value="oneapi">OneAPI (完整功能)</SelectItem>
                  <SelectItem value="yourapi">YourAPI (完整功能)</SelectItem>
                  <SelectItem value="custom">自定义 (仅配置切换)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="system_token" className="text-right">
                {formData.adapter === 'custom' ? 'API密钥' : '系统令牌'}
              </Label>
              <div className="col-span-3 relative">
                <Input
                  id="system_token"
                  name="api_key_"
                  type={showPassword ? "text" : "password"}
                  value={formData.system_token}
                  onChange={(e) => setFormData({ ...formData, system_token: e.target.value })}
                  className="pr-10"
                  placeholder={formData.adapter === 'custom' ? '输入API密钥 (如: sk-...)' : '输入系统管理令牌'}
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-muted"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            {formData.adapter !== 'custom' && (formData.adapter === 'newapi' || formData.adapter === 'yourapi') && (
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
                  placeholder="用户ID"
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
              {editMode ? '保存更改' : '添加站点'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const TokenDetailView: React.FC<TokenDetailViewProps> = ({ token, station, onBack, onTokenUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<TokenGroup[]>([]);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [formData, setFormData] = useState({
    name: token.name,
    group: token.group || '',
    remain_quota: token.remain_quota || 0,
    expired_time: token.expires_at === -1 ? -1 : (token.expires_at ? token.expires_at * 1000 : -1),
    unlimited_quota: token.unlimited_quota || false,
    enabled: token.enabled,
  });

  useEffect(() => {
    loadGroups();
  }, [station.id]);

  const loadGroups = async () => {
    try {
      console.log('Loading groups for station:', station.id);
      const groupsData = await api.getUserTokenGroups(station.id);
      console.log('Groups loaded:', groupsData);
      setGroups(groupsData);
    } catch (error) {
      console.error('Failed to load token groups:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tokenRequest: UpdateTokenRequest = {
        id: parseInt(token.id),
        name: formData.name,
        group: formData.group === '__no_group__' ? undefined : formData.group || undefined,
        expired_time: formData.expired_time === -1 ? -1 : Math.floor(formData.expired_time / 1000),
        remain_quota: formData.unlimited_quota ? undefined : formData.remain_quota,
        unlimited_quota: formData.unlimited_quota,
        enabled: formData.enabled,
      };

      await api.updateStationToken(station.id, token.id, tokenRequest);
      onTokenUpdated();
    } catch (error) {
      console.error('Failed to update token:', error);
      setToastMessage({ 
        message: '更新令牌失败，请检查输入信息并稍后重试。', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(`sk-${token.token}`);
      setToastMessage({ 
        message: `令牌 "${token.name}" 已复制到剪贴板！`, 
        type: 'success' 
      });
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback: create a temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = `sk-${token.token}`;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      
      setToastMessage({ 
        message: `令牌 "${token.name}" 已复制到剪贴板！`, 
        type: 'success' 
      });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">编辑令牌</h2>
            <p className="text-muted-foreground">{token.name} - {station.name}</p>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>令牌设置</CardTitle>
          <CardDescription>修改令牌的配置信息</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="edit_token_name">令牌名称</Label>
                <Input
                  id="edit_token_name"
                  name="edit_token_name_"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-form-type="other"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_token_group">分组</Label>
                <Select value={formData.group || '__no_group__'} onValueChange={(value) => setFormData({ ...formData, group: value === '__no_group__' ? '' : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择分组（可选）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__no_group__">无分组</SelectItem>
                    {groups.map((group) => {
                      console.log('Rendering group option in edit:', group);
                      return (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}{group.description && ` (${group.description})`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit_unlimited_quota">不限额度</Label>
                  <Switch
                    id="edit_unlimited_quota"
                    checked={formData.unlimited_quota}
                    onCheckedChange={(checked) => setFormData({ ...formData, unlimited_quota: checked })}
                  />
                </div>
              </div>

              {!formData.unlimited_quota && (
                <div className="space-y-2">
                  <Label htmlFor="edit_remain_quota">额度限制</Label>
                  <Input
                    id="edit_remain_quota"
                    name="edit_quota_limit_"
                    type="number"
                    value={formData.remain_quota}
                    onChange={(e) => setFormData({ ...formData, remain_quota: parseInt(e.target.value) || 0 })}
                    autoComplete="off"
                    min="0"
                    step="1000"
                    placeholder="请输入额度限制"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit_never_expire">永不过期</Label>
                  <Switch
                    id="edit_never_expire"
                    checked={formData.expired_time === -1}
                    onCheckedChange={(checked) => setFormData({ ...formData, expired_time: checked ? -1 : Date.now() + 30 * 24 * 60 * 60 * 1000 })}
                  />
                </div>
              </div>

              {formData.expired_time !== -1 && (
                <div className="space-y-2">
                  <Label htmlFor="edit_expired_time">过期时间</Label>
                  <Input
                    id="edit_expired_time"
                    name="edit_expire_date_"
                    type="datetime-local"
                    value={new Date(formData.expired_time).toISOString().slice(0, 16)}
                    onChange={(e) => setFormData({ ...formData, expired_time: new Date(e.target.value).getTime() })}
                    autoComplete="off"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit_token_enabled">启用</Label>
                  <Switch
                    id="edit_token_enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  />
                </div>
              </div>
            </div>

            {/* Token Info */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">令牌信息</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">令牌值</Label>
                  <div className="relative">
                    <p className="font-mono bg-muted/30 p-2 rounded border break-all pr-10">sk-{token.token}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyToken}
                      className="absolute top-1 right-1 h-8 w-8 p-0 hover:bg-muted"
                      title="复制令牌"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">创建时间</Label>
                  <p>{new Date(token.created_at * 1000).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onBack}>
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存更改
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto">
            <Toast
              message={toastMessage.message}
              type={toastMessage.type}
              onDismiss={() => setToastMessage(null)}
            />
          </div>
        </div>
      )}
    </div>
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
  const [tokenError, setTokenError] = useState<boolean>(false); // Separate state for token errors
  const [selectedLog, setSelectedLog] = useState<StationLogEntry | null>(null);
  const [showLogDetails, setShowLogDetails] = useState(false);
  const [selectedToken, setSelectedToken] = useState<RelayStationToken | null>(null);
  const [tokenViewState, setTokenViewState] = useState<TokenViewState>('list');
  const [showAddTokenDialog, setShowAddTokenDialog] = useState(false);
  const [showEditStationDialog, setShowEditStationDialog] = useState(false);
  const [showDeleteTokenDialog, setShowDeleteTokenDialog] = useState(false);
  const [showDeleteStationDialog, setShowDeleteStationDialog] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingToken, setDeletingToken] = useState(false);
  const [deletingStation, setDeletingStation] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [currentProviderConfig, setCurrentProviderConfig] = useState<any>(null);
  
  // Log filtering state
  const [logFilters, setLogFilters] = useState({
    startTime: '',
    endTime: '',
    modelName: '',
    group: '',
  });
  const [showLogFilters, setShowLogFilters] = useState(false);

  // Token pagination state
  const [tokenPagination, setTokenPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    hasMore: false
  });

  // Track which tabs have been loaded to avoid duplicate requests
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());
  
  // Cache for API requests with timestamps
  const [apiCache, setApiCache] = useState<{
    basicData?: { timestamp: number; data: any };
    tokens?: { timestamp: number; data: RelayStationToken[] };
    logs?: { timestamp: number; data: LogPaginationResponse };
  }>({});
  
  const CACHE_DURATION = 2000; // 2 seconds cache

  const isCacheValid = (cacheEntry: { timestamp: number } | undefined): boolean => {
    if (!cacheEntry) return false;
    return Date.now() - cacheEntry.timestamp < CACHE_DURATION;
  };

  useEffect(() => {
    // Always load basic info and user info on mount
    loadBasicData();
    loadCurrentProviderConfig();
  }, [station.id]);

  const loadCurrentProviderConfig = async () => {
    try {
      const config = await api.getCurrentProviderConfig();
      setCurrentProviderConfig(config);
    } catch (error) {
      console.error('Failed to load current provider config:', error);
    }
  };

  // 检查令牌是否被应用
  const isTokenApplied = (token: RelayStationToken): boolean => {
    if (!currentProviderConfig) return false;
    
    // 检查API地址是否匹配
    const baseUrlMatches = currentProviderConfig.anthropic_base_url === station.api_url;
    
    // 检查认证令牌是否匹配
    const authTokenMatches = currentProviderConfig.anthropic_auth_token === `sk-${token.token}`;
    
    return baseUrlMatches && authTokenMatches;
  };

  // 检查自定义中转站是否被应用
  const isCustomStationApplied = (): boolean => {
    if (!currentProviderConfig || station.adapter !== 'custom') return false;
    
    // 检查API地址和认证令牌是否匹配
    const baseUrlMatches = currentProviderConfig.anthropic_base_url === station.api_url;
    const authTokenMatches = currentProviderConfig.anthropic_auth_token === station.system_token;
    
    return baseUrlMatches && authTokenMatches;
  };

  useEffect(() => {
    // Load data when tab changes, but skip if it's the initial 'info' tab since loadBasicData already handles it
    if (activeTab !== 'info') {
      handleTabChange(activeTab);
    }
  }, [activeTab]);

  const loadBasicData = async () => {
    // Check cache first
    if (isCacheValid(apiCache.basicData)) {
      console.log('Using cached basic data for station:', station.id);
      const cachedData = apiCache.basicData!.data;
      setStationInfo(cachedData.stationInfo);
      setUserInfo(cachedData.userInfo);
      setConnectionTest(cachedData.connectionTest);
      setInitialLoading(false);
      setLoadedTabs(prev => new Set(prev).add('info'));
      return;
    }

    setInitialLoading(true);
    setError(null);
    try {
      console.log('Loading basic station data for:', station.id);
      
      // Load station info
      const info = await api.getStationInfo(station.id);
      console.log('Station info loaded:', info);
      setStationInfo(info);

      // For custom adapters, skip user info and connection test
      let userInfoData = null;
      let testResult = null;

      if (station.adapter !== 'custom') {
        // Load user info if user_id is available
        if (station.user_id) {
          try {
            userInfoData = await api.getTokenUserInfo(station.id, station.user_id);
            console.log('User info loaded:', userInfoData);
            setUserInfo(userInfoData);
          } catch (userError) {
            console.error('Failed to load user info:', userError);
            // Don't fail the entire load if only user info fails
          }
        }

        // Test connection
        try {
          testResult = await api.testStationConnection(station.id);
          console.log('Connection test result:', testResult);
          setConnectionTest(testResult);
        } catch (testError) {
          console.error('Failed to test connection:', testError);
          testResult = { success: false, message: `Connection test failed: ${testError}` };
          setConnectionTest(testResult);
        }
      } else {
        // For custom adapters, set default values
        testResult = { success: true, message: 'Custom configuration - connection testing not applicable' };
        setConnectionTest(testResult);
      }

      // Cache the results
      setApiCache(prev => ({
        ...prev,
        basicData: {
          timestamp: Date.now(),
          data: {
            stationInfo: info,
            userInfo: userInfoData,
            connectionTest: testResult
          }
        }
      }));

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

    // Skip loading data for unsupported tabs on custom adapters
    if (station.adapter === 'custom' && (tabValue === 'tokens' || tabValue === 'logs')) {
      return;
    }

    // Set loading state only for the specific tab
    setTabLoading(true);
    try {
      switch (tabValue) {
        case 'tokens':
          if (station.adapter === 'custom') {
            break; // Skip tokens for custom adapters
          }
          console.log('Loading tokens for tab switch');
          
          // Check cache first
          if (isCacheValid(apiCache.tokens)) {
            console.log('Using cached tokens for station:', station.id);
            setTokens(apiCache.tokens!.data);
            setTokenError(false);
            break;
          }
          
          try {
            const tokenResponse = await api.listStationTokens(station.id, 1, tokenPagination.pageSize);
            console.log('Tokens loaded:', tokenResponse);
            setTokens(tokenResponse.items);
            setTokenPagination(prev => ({
              ...prev,
              page: tokenResponse.page,
              total: tokenResponse.total,
              hasMore: tokenResponse.page * tokenResponse.page_size < tokenResponse.total
            }));
            // Clear any previous token error if tokens load successfully
            setTokenError(false);
            
            // Cache the results
            setApiCache(prev => ({
              ...prev,
              tokens: {
                timestamp: Date.now(),
                data: tokenResponse.items
              }
            }));
          } catch (tokenError) {
            console.error('Failed to load tokens:', tokenError);
            const errorMessage = tokenError instanceof Error ? tokenError.message : String(tokenError);
            console.log('Token error message:', errorMessage);
            
            // Set token error state for incompatible stations
            setTokenError(true);
            setTokens([]); // Clear tokens on error
            throw tokenError; // Re-throw to be caught by outer catch
          }
          break;

        case 'logs':
          if (station.adapter === 'custom') {
            break; // Skip logs for custom adapters
          }
          console.log('Loading logs for tab switch');
          
          // Check cache first
          if (isCacheValid(apiCache.logs)) {
            console.log('Using cached logs for station:', station.id);
            setLogsPagination(apiCache.logs!.data);
            break;
          }
          
          const logsData = await api.getStationLogs(station.id, 1, 10, logFilters);
          console.log('Logs loaded:', logsData);
          setLogsPagination(logsData);
          
          // Cache the results
          setApiCache(prev => ({
            ...prev,
            logs: {
              timestamp: Date.now(),
              data: logsData
            }
          }));
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

  const loadLogsPage = async (page: number, pageSize: number = 10, filters?: any) => {
    setTabLoading(true);
    try {
      const filtersToUse = filters || logFilters;
      const logsData = await api.getStationLogs(station.id, page, pageSize, filtersToUse);
      setLogsPagination(logsData);
      
      // Update cache
      setApiCache(prev => ({
        ...prev,
        logs: {
          timestamp: Date.now(),
          data: logsData
        }
      }));
    } catch (error) {
      console.error('Failed to load logs page:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Logs page ${page} error:`, errorMessage);
    } finally {
      setTabLoading(false);
    }
  };

  const handleLogClick = (log: StationLogEntry) => {
    setSelectedLog(log);
    setShowLogDetails(true);
  };

  const handleApplyLogFilters = () => {
    // Clear cache since we're applying new filters
    setApiCache(prev => ({ ...prev, logs: undefined }));
    loadLogsPage(1, 10, logFilters);
  };

  const handleResetLogFilters = () => {
    const resetFilters = {
      startTime: '',
      endTime: '',
      modelName: '',
      group: '',
    };
    setLogFilters(resetFilters);
    // Clear cache and reload with no filters
    setApiCache(prev => ({ ...prev, logs: undefined }));
    loadLogsPage(1, 10, resetFilters);
  };

  const loadTokensPage = async (page: number = 1, pageSize: number = 10) => {
    setTabLoading(true);
    try {
      const tokenResponse = await api.listStationTokens(station.id, page, pageSize);
      setTokens(tokenResponse.items);
      setTokenPagination({
        page: tokenResponse.page,
        pageSize: tokenResponse.page_size,
        total: tokenResponse.total,
        hasMore: tokenResponse.page * tokenResponse.page_size < tokenResponse.total
      });
      
      // Update cache
      setApiCache(prev => ({
        ...prev,
        tokens: {
          timestamp: Date.now(),
          data: tokenResponse.items
        }
      }));
      
      setTokenError(false);
    } catch (tokenError) {
      console.error('Failed to load tokens:', tokenError);
      setTokenError(true);
      setTokens([]);
      setTokenPagination({
        page: 1,
        pageSize: 10,
        total: 0,
        hasMore: false
      });
    } finally {
      setTabLoading(false);
    }
  };

  const handleTokenClick = (token: RelayStationToken) => {
    setSelectedToken(token);
    setTokenViewState('details');
  };

  const handleBackToTokenList = () => {
    setTokenViewState('list');
    setSelectedToken(null);
  };

  const handleToggleToken = async (tokenId: string, enabled: boolean) => {
    try {
      await api.toggleStationToken(station.id, tokenId, enabled);
      // Reload tokens
      const tokenResponse = await api.listStationTokens(station.id, tokenPagination.page, tokenPagination.pageSize);
      setTokens(tokenResponse.items);
      setTokenPagination(prev => ({
        ...prev,
        page: tokenResponse.page,
        total: tokenResponse.total,
        hasMore: tokenResponse.page * tokenResponse.page_size < tokenResponse.total
      }));
      
      // Success message
      setToastMessage({ 
        message: `令牌已${enabled ? '启用' : '禁用'}成功！`, 
        type: 'success' 
      });
    } catch (error) {
      console.error('Failed to toggle token:', error);
      setToastMessage({ 
        message: `${enabled ? '启用' : '禁用'}令牌失败，请稍后重试。`, 
        type: 'error' 
      });
    }
  };

  const handleDeleteToken = async (tokenId: string, tokenName: string) => {
    // Set the token to delete and show confirmation dialog
    setTokenToDelete({ id: tokenId, name: tokenName });
    setShowDeleteTokenDialog(true);
  };

  const confirmDeleteToken = async () => {
    if (!tokenToDelete) return;
    
    setDeletingToken(true);
    try {
      await api.deleteStationToken(station.id, tokenToDelete.id);
      // Reload tokens
      const tokenResponse = await api.listStationTokens(station.id, tokenPagination.page, tokenPagination.pageSize);
      setTokens(tokenResponse.items);
      setTokenPagination(prev => ({
        ...prev,
        page: tokenResponse.page,
        total: tokenResponse.total,
        hasMore: tokenResponse.page * tokenResponse.page_size < tokenResponse.total
      }));
      
      // Success message
      setToastMessage({ 
        message: `令牌 "${tokenToDelete.name}" 已删除成功！`, 
        type: 'success' 
      });
    } catch (error) {
      console.error('Failed to delete token:', error);
      setToastMessage({ 
        message: '删除令牌失败，请稍后重试。', 
        type: 'error' 
      });
    } finally {
      // Close dialog and clear state
      setDeletingToken(false);
      setShowDeleteTokenDialog(false);
      setTokenToDelete(null);
    }
  };

  const confirmDeleteStation = async () => {
    setDeletingStation(true);
    try {
      await api.deleteRelayStation(station.id);
      onBack();
      onStationUpdated();
    } catch (error) {
      console.error('Failed to delete station:', error);
      setToastMessage({ 
        message: '删除中转站失败，请稍后重试。', 
        type: 'error' 
      });
    } finally {
      setDeletingStation(false);
      setShowDeleteStationDialog(false);
    }
  };

  const handleTokenAdded = async () => {
    // Reload tokens after adding
    try {
      // Clear tokens cache
      setApiCache(prev => ({ ...prev, tokens: undefined }));
      
      const tokenResponse = await api.listStationTokens(station.id, 1, tokenPagination.pageSize);
      setTokens(tokenResponse.items);
      setTokenPagination(prev => ({
        ...prev,
        page: tokenResponse.page,
        total: tokenResponse.total,
        hasMore: tokenResponse.page * tokenResponse.page_size < tokenResponse.total
      }));
      setShowAddTokenDialog(false);
      
      // Update cache
      setApiCache(prev => ({
        ...prev,
        tokens: {
          timestamp: Date.now(),
          data: tokenResponse.items
        }
      }));
      
      // Success message
      setToastMessage({ 
        message: '令牌添加成功！', 
        type: 'success' 
      });
    } catch (error) {
      console.error('Failed to reload tokens:', error);
      setToastMessage({ 
        message: '令牌添加后重新加载失败，请刷新页面查看最新状态。', 
        type: 'error' 
      });
    }
  };

  const handleTokenUpdated = async () => {
    // Reload tokens after updating
    try {
      // Clear tokens cache
      setApiCache(prev => ({ ...prev, tokens: undefined }));
      
      const tokenResponse = await api.listStationTokens(station.id, tokenPagination.page, tokenPagination.pageSize);
      setTokens(tokenResponse.items);
      setTokenPagination(prev => ({
        ...prev,
        page: tokenResponse.page,
        total: tokenResponse.total,
        hasMore: tokenResponse.page * tokenResponse.page_size < tokenResponse.total
      }));
      setTokenViewState('list');
      setSelectedToken(null);
      
      // Update cache
      setApiCache(prev => ({
        ...prev,
        tokens: {
          timestamp: Date.now(),
          data: tokenResponse.items
        }
      }));
      
      // Success message
      setToastMessage({ 
        message: '令牌更新成功！', 
        type: 'success' 
      });
    } catch (error) {
      console.error('Failed to reload tokens:', error);
      setToastMessage({ 
        message: '令牌更新后重新加载失败，请刷新页面查看最新状态。', 
        type: 'error' 
      });
    }
  };

  const handleApplyCustomStation = async () => {
    try {
      // 对于自定义类型的中转站，直接应用其配置
      const providerConfig = {
        id: `custom-${station.id}`, // 生成唯一ID
        name: station.name,
        description: station.description || `自定义配置 - ${station.name}`,
        base_url: station.api_url,
        auth_token: station.system_token, // 对于自定义类型，system_token写入ANTHROPIC_AUTH_TOKEN
      };
      
      await api.switchProviderConfig(providerConfig);
      await loadCurrentProviderConfig(); // 重新加载当前配置
      setToastMessage({ 
        message: `已应用中转站 "${station.name}" 的配置！`, 
        type: 'success' 
      });
    } catch (error) {
      console.error('Failed to apply custom station:', error);
      setToastMessage({ 
        message: '应用配置失败，请稍后重试。', 
        type: 'error' 
      });
    }
  };

  const handleApplyToken = async (token: RelayStationToken) => {
    try {
      // 创建代理商配置从令牌和中转站信息
      const providerConfig = {
        id: `token-${station.id}-${token.id}`, // 生成唯一ID
        name: `${station.name} - ${token.name}`,
        description: `从中转站 ${station.name} 应用的令牌配置`,
        base_url: station.api_url,
        auth_token: `sk-${token.token}`, // 使用sk-前缀写入ANTHROPIC_AUTH_TOKEN
      };
      
      await api.switchProviderConfig(providerConfig);
      await loadCurrentProviderConfig(); // 重新加载当前配置
      setToastMessage({ 
        message: `已应用令牌 "${token.name}" 的配置！`, 
        type: 'success' 
      });
    } catch (error) {
      console.error('Failed to apply token:', error);
      setToastMessage({ 
        message: '应用令牌配置失败，请稍后重试。', 
        type: 'error' 
      });
    }
  };

  const handleCopyToken = async (token: string, tokenName: string) => {
    try {
      await navigator.clipboard.writeText(`sk-${token}`);
      setToastMessage({ 
        message: `令牌 "${tokenName}" 已复制到剪贴板！`, 
        type: 'success' 
      });
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback: create a temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = `sk-${token}`;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      
      setToastMessage({ 
        message: `令牌 "${tokenName}" 已复制到剪贴板！`, 
        type: 'success' 
      });
    }
  };

  const handleStationEdited = async () => {
    // Reload station data after editing
    try {
      // Clear all cache since station data might have changed
      setApiCache({});
      
      await loadBasicData();
      onStationUpdated(); // Also notify parent to refresh the station list
      setShowEditStationDialog(false);
      
      setToastMessage({ 
        message: '中转站配置更新成功！', 
        type: 'success' 
      });
    } catch (error) {
      console.error('Failed to reload station data:', error);
      setToastMessage({ 
        message: '中转站更新后重新加载失败，请刷新页面查看最新状态。', 
        type: 'error' 
      });
    }
  };

  // Format quota as USD price
  const formatPrice = (quota: number | undefined): string => {
    if (!quota) return '$0.00';
    const quotaPerUnit = stationInfo?.quota_per_unit || 500000; // Default to 500000 if not available
    const price = quota / quotaPerUnit;
    return `$${price.toFixed(4)}`;
  };

  // If in token detail view, show TokenDetailView
  if (tokenViewState === 'details' && selectedToken) {
    return (
      <TokenDetailView
        token={selectedToken}
        station={station}
        onBack={handleBackToTokenList}
        onTokenUpdated={handleTokenUpdated}
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
          {/* User Info Cards - Only show for non-custom adapters */}
          {station.adapter !== 'custom' && (
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
          )}

          {/* Tabs for detailed info */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className={`grid w-full ${station.adapter === 'custom' ? 'grid-cols-2' : 'grid-cols-4'}`}>
                <TabsTrigger value="info">站点信息</TabsTrigger>
                {station.adapter !== 'custom' && <TabsTrigger value="tokens">令牌管理</TabsTrigger>}
                {station.adapter !== 'custom' && <TabsTrigger value="logs">使用日志</TabsTrigger>}
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
                      {station.adapter !== 'custom' && (
                        <div>
                          <Label className="text-sm font-medium">版本</Label>
                          <p className="text-sm text-muted-foreground">{stationInfo?.version || '未知'}</p>
                        </div>
                      )}
                      {station.adapter !== 'custom' && (
                        <div>
                          <Label className="text-sm font-medium">用户名</Label>
                          <p className="text-sm text-muted-foreground">{userInfo?.username || '未知'}</p>
                        </div>
                      )}
                      {station.adapter !== 'custom' && (
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
                      )}
                      {station.adapter === 'custom' && (
                        <div>
                          <Label className="text-sm font-medium">配置类型</Label>
                          <p className="text-sm text-muted-foreground">自定义代理配置</p>
                        </div>
                      )}
                    </div>
                    {station.adapter === 'custom' && (
                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="text-sm font-medium">快速应用配置</h4>
                            <p className="text-xs text-muted-foreground">将此站点的配置应用为当前代理商</p>
                            {isCustomStationApplied() && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-green-600 dark:text-green-400">
                                <Shield className="h-3 w-3" />
                                <span>当前正在使用此配置</span>
                              </div>
                            )}
                          </div>
                          <Button 
                            onClick={handleApplyCustomStation} 
                            className={isCustomStationApplied() ? "bg-green-600 hover:bg-green-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
                            disabled={isCustomStationApplied()}
                          >
                            {isCustomStationApplied() ? (
                              <>
                                <Shield className="h-4 w-4 mr-2" />
                                已应用
                              </>
                            ) : (
                              <>
                                <PlayCircle className="h-4 w-4 mr-2" />
                                应用配置
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                    {stationInfo?.announcement && station.adapter !== 'custom' && (
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
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>令牌管理</CardTitle>
                        <CardDescription>管理该站点的访问令牌</CardDescription>
                      </div>
                      <Button onClick={() => setShowAddTokenDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        添加令牌
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {tabLoading && activeTab === 'tokens' ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="ml-2">加载令牌数据...</span>
                      </div>
                    ) : tokenError && activeTab === 'tokens' ? (
                      <div className="text-center py-12">
                        <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2 text-destructive">无法加载令牌</h3>
                        <p className="text-muted-foreground mb-4">
                          无法从当前中转站加载令牌信息，请切换中转站类型或检查配置
                        </p>
                        <div className="flex gap-2 justify-center">
                          <Button variant="outline" onClick={() => setShowEditStationDialog(true)}>
                            <Edit className="h-4 w-4 mr-2" />
                            编辑配置
                          </Button>
                          <Button onClick={() => handleTabChange('tokens')}>
                            重试
                          </Button>
                        </div>
                      </div>
                    ) : tokens.length === 0 ? (
                      <div className="text-center py-12">
                        <Hash className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">暂无令牌</h3>
                        <p className="text-muted-foreground mb-4">
                          添加您的第一个令牌以开始使用
                        </p>
                        <Button onClick={() => setShowAddTokenDialog(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          添加令牌
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tokens.map((token) => (
                          <div key={token.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                            <div className="flex-1 cursor-pointer" onClick={() => handleTokenClick(token)}>
                              <div className="flex items-center gap-3">
                                <h4 className="font-medium text-base">{token.name}</h4>
                                {isTokenApplied(token) && (
                                  <Badge variant="default" className="text-xs bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                                    <Shield className="h-3 w-3 mr-1" />
                                    已应用
                                  </Badge>
                                )}
                                {token.group && (
                                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20">
                                    <Users className="h-3 w-3 mr-1" />
                                    {token.group}
                                  </Badge>
                                )}
                                {token.expires_at && token.expires_at !== -1 && (
                                  <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950/20">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    {new Date(token.expires_at * 1000).toLocaleDateString()}
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono">sk-{token.token.substring(0, 20)}...</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyToken(token.token, token.name);
                                    }}
                                    className="h-6 w-6 p-0 hover:bg-muted"
                                    title="复制完整令牌"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                                {token.unlimited_quota ? (
                                  <span className="text-green-600 dark:text-green-400">不限额度</span>
                                ) : (
                                  <span>余额: {token.remain_quota || 0}</span>
                                )}
                                <span>创建: {new Date(token.created_at * 1000).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant={isTokenApplied(token) ? "default" : "outline"}
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApplyToken(token);
                                }}
                                title={isTokenApplied(token) ? '已应用此令牌' : '应用此令牌配置'}
                                className={isTokenApplied(token) ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                                disabled={isTokenApplied(token)}
                              >
                                {isTokenApplied(token) ? (
                                  <Shield className="h-4 w-4" />
                                ) : (
                                  <PlayCircle className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant={token.enabled ? "outline" : "default"}
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleToken(token.id, !token.enabled);
                                }}
                                title={token.enabled ? '禁用令牌' : '启用令牌'}
                              >
                                {token.enabled ? (
                                  <PowerOff className="h-4 w-4" />
                                ) : (
                                  <Power className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTokenClick(token);
                                }}
                                title="编辑令牌"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteToken(token.id, token.name);
                                }}
                                title="删除令牌"
                                className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        
                        {/* Token Pagination */}
                        {tokenPagination.total > tokenPagination.pageSize && (
                          <div className="flex items-center justify-between pt-6 border-t border-border/50">
                            <div className="text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
                              显示 {(tokenPagination.page - 1) * tokenPagination.pageSize + 1} - {Math.min(tokenPagination.page * tokenPagination.pageSize, tokenPagination.total)} 
                              条，共 {tokenPagination.total} 条令牌
                            </div>
                            <div className="flex items-center gap-1">
                              {(() => {
                                const totalPages = Math.ceil(tokenPagination.total / tokenPagination.pageSize);
                                const currentPage = tokenPagination.page;
                                const pages: (number | string)[] = [];
                                
                                if (totalPages <= 7) {
                                  // 如果总页数小于等于7，显示所有页数
                                  for (let i = 1; i <= totalPages; i++) {
                                    pages.push(i);
                                  }
                                } else {
                                  // 总页数大于7时的逻辑
                                  if (currentPage <= 4) {
                                    // 当前页在前部
                                    pages.push(1, 2, 3, 4, 5, '...', totalPages);
                                  } else if (currentPage >= totalPages - 3) {
                                    // 当前页在后部
                                    pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                                  } else {
                                    // 当前页在中间
                                    pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
                                  }
                                }
                                
                                return pages.map((page, index) => {
                                  if (page === '...') {
                                    return (
                                      <span key={`ellipsis-${index}`} className="px-2 py-1 text-sm text-muted-foreground">
                                        ...
                                      </span>
                                    );
                                  }
                                  
                                  const pageNum = page as number;
                                  const isCurrentPage = pageNum === currentPage;
                                  
                                  return (
                                    <Button
                                      key={pageNum}
                                      variant={isCurrentPage ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => loadTokensPage(pageNum, tokenPagination.pageSize)}
                                      className={`h-8 w-8 p-0 ${isCurrentPage ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/10'}`}
                                      disabled={isCurrentPage}
                                    >
                                      {pageNum}
                                    </Button>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logs" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>使用日志</CardTitle>
                        <CardDescription>
                          API调用记录 {logsPagination && `(共 ${logsPagination.total} 条)`}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowLogFilters(!showLogFilters)}
                          className={showLogFilters ? "bg-primary/10" : ""}
                        >
                          <Filter className="h-4 w-4 mr-2" />
                          筛选
                        </Button>
                        {(logFilters.startTime || logFilters.endTime || logFilters.modelName || logFilters.group) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetLogFilters}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            重置
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Log Filters */}
                    {showLogFilters && (
                      <div className="mb-6 p-4 border rounded-lg bg-muted/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="start_time">开始时间</Label>
                            <Input
                              id="start_time"
                              type="datetime-local"
                              value={logFilters.startTime}
                              onChange={(e) => setLogFilters(prev => ({ ...prev, startTime: e.target.value }))}
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="end_time">结束时间</Label>
                            <Input
                              id="end_time"
                              type="datetime-local"
                              value={logFilters.endTime}
                              onChange={(e) => setLogFilters(prev => ({ ...prev, endTime: e.target.value }))}
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="model_name">模型名称</Label>
                            <Input
                              id="model_name"
                              type="text"
                              placeholder="如: gpt-4, claude-3"
                              value={logFilters.modelName}
                              onChange={(e) => setLogFilters(prev => ({ ...prev, modelName: e.target.value }))}
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="group_name">分组</Label>
                            <Input
                              id="group_name"
                              type="text"
                              placeholder="分组名称"
                              value={logFilters.group}
                              onChange={(e) => setLogFilters(prev => ({ ...prev, group: e.target.value }))}
                              className="text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button
                            onClick={handleApplyLogFilters}
                            size="sm"
                            className="flex-shrink-0"
                          >
                            <Filter className="h-4 w-4 mr-2" />
                            应用筛选
                          </Button>
                          <Button
                            variant="outline"
                            onClick={handleResetLogFilters}
                            size="sm"
                            className="flex-shrink-0"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            清空条件
                          </Button>
                        </div>
                      </div>
                    )}
                    
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
                            <div className="flex items-center gap-1">
                              {(() => {
                                const totalPages = Math.ceil(logsPagination.total / logsPagination.page_size);
                                const currentPage = logsPagination.page;
                                const pages: (number | string)[] = [];
                                
                                if (totalPages <= 7) {
                                  // 如果总页数小于等于7，显示所有页数
                                  for (let i = 1; i <= totalPages; i++) {
                                    pages.push(i);
                                  }
                                } else {
                                  // 总页数大于7时的逻辑
                                  if (currentPage <= 4) {
                                    // 当前页在前部
                                    pages.push(1, 2, 3, 4, 5, '...', totalPages);
                                  } else if (currentPage >= totalPages - 3) {
                                    // 当前页在后部
                                    pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                                  } else {
                                    // 当前页在中间
                                    pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
                                  }
                                }
                                
                                return pages.map((page, index) => {
                                  if (page === '...') {
                                    return (
                                      <span key={`ellipsis-${index}`} className="px-2 py-1 text-sm text-muted-foreground">
                                        ...
                                      </span>
                                    );
                                  }
                                  
                                  const pageNum = page as number;
                                  const isCurrentPage = pageNum === currentPage;
                                  
                                  return (
                                    <Button
                                      key={pageNum}
                                      variant={isCurrentPage ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => loadLogsPage(pageNum, 10)}
                                      className={`h-8 w-8 p-0 ${isCurrentPage ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/10'}`}
                                      disabled={isCurrentPage}
                                    >
                                      {pageNum}
                                    </Button>
                                  );
                                });
                              })()}
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
                        <Button variant="outline" onClick={() => setShowEditStationDialog(true)}>
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
                          onClick={() => setShowDeleteStationDialog(true)}
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
      
      {/* Add Token Dialog */}
      <AddTokenDialog
        open={showAddTokenDialog}
        onOpenChange={setShowAddTokenDialog}
        station={station}
        onTokenAdded={handleTokenAdded}
      />
      
      {/* Edit Station Dialog */}
      <AddStationDialog
        open={showEditStationDialog}
        onOpenChange={setShowEditStationDialog}
        editMode={true}
        editStation={station}
        onStationAdded={handleStationEdited}
      />
      
      {/* Delete Token Confirmation Dialog */}
      <Dialog open={showDeleteTokenDialog} onOpenChange={setShowDeleteTokenDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              确认删除令牌
            </DialogTitle>
            <DialogDescription>
              此操作将永久删除令牌，无法撤销。请确认您要删除此令牌。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-muted/50 rounded-lg p-4 border border-muted">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {tokenToDelete?.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    令牌ID: {tokenToDelete?.id}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">警告</p>
                  <p className="text-destructive/80 mt-1">
                    删除后，使用此令牌的应用程序将无法访问API服务。
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteTokenDialog(false);
                setTokenToDelete(null);
              }}
              disabled={deletingToken}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteToken}
              className="gap-2"
              disabled={deletingToken}
            >
              {deletingToken ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {deletingToken ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Station Confirmation Dialog */}
      <Dialog open={showDeleteStationDialog} onOpenChange={setShowDeleteStationDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              确认删除中转站
            </DialogTitle>
            <DialogDescription>
              此操作将永久删除中转站及其所有相关数据，无法撤销。请谨慎操作。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-muted/50 rounded-lg p-4 border border-muted">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <Server className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {station.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {station.api_url}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    适配器: {station.adapter} | ID: {station.id}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive">数据删除警告</p>
                    <p className="text-destructive/80 mt-1">
                      删除后将无法恢复以下数据：
                    </p>
                  </div>
                </div>
              </div>
              <div className="pl-6 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Hash className="h-3 w-3" />
                  <span>所有令牌配置和访问密钥</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="h-3 w-3" />
                  <span>历史日志记录</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-3 w-3" />
                  <span>用户权限和分组设置</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteStationDialog(false)}
              disabled={deletingStation}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteStation}
              className="gap-2"
              disabled={deletingStation}
            >
              {deletingStation ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {deletingStation ? '删除中...' : '确认删除中转站'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto">
            <Toast
              message={toastMessage.message}
              type={toastMessage.type}
              onDismiss={() => setToastMessage(null)}
            />
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
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [currentProviderConfig, setCurrentProviderConfig] = useState<any>(null);

  const handleApplyStationFromList = async (station: RelayStation) => {
    try {
      // 对于自定义类型的中转站，直接应用其配置
      const providerConfig = {
        id: `custom-${station.id}`, // 生成唯一ID
        name: station.name,
        description: station.description || `自定义配置 - ${station.name}`,
        base_url: station.api_url,
        auth_token: station.system_token, // 对于自定义类型，system_token写入ANTHROPIC_AUTH_TOKEN
      };
      
      await api.switchProviderConfig(providerConfig);
      await loadCurrentProviderConfig(); // 重新加载当前配置
      setToastMessage({ 
        message: `已应用中转站 "${station.name}" 的配置！`, 
        type: 'success' 
      });
    } catch (error) {
      console.error('Failed to apply custom station:', error);
      setToastMessage({ 
        message: '应用配置失败，请稍后重试。', 
        type: 'error' 
      });
    }
  };

  useEffect(() => {
    loadStations();
    loadCurrentProviderConfig();
  }, []);

  const loadCurrentProviderConfig = async () => {
    try {
      const config = await api.getCurrentProviderConfig();
      setCurrentProviderConfig(config);
    } catch (error) {
      console.error('Failed to load current provider config:', error);
    }
  };

  // 检查自定义中转站是否被应用
  const isCustomStationApplied = (station: RelayStation): boolean => {
    if (!currentProviderConfig || station.adapter !== 'custom') return false;
    
    // 检查API地址和认证令牌是否匹配
    const baseUrlMatches = currentProviderConfig.anthropic_base_url === station.api_url;
    const authTokenMatches = currentProviderConfig.anthropic_auth_token === station.system_token;
    
    return baseUrlMatches && authTokenMatches;
  };

  // 获取当前应用的配置信息用于显示
  const getAppliedConfigInfo = (): { station?: RelayStation; baseUrl?: string; partialKey?: string } | null => {
    if (!currentProviderConfig) return null;

    // 检查是否有匹配的自定义中转站
    const appliedCustomStation = stations.find(station => 
      station.adapter === 'custom' && isCustomStationApplied(station)
    );

    if (appliedCustomStation) {
      return {
        station: appliedCustomStation,
        baseUrl: currentProviderConfig.anthropic_base_url,
        partialKey: currentProviderConfig.anthropic_auth_token ? 
          `${currentProviderConfig.anthropic_auth_token.substring(0, 8)}...${currentProviderConfig.anthropic_auth_token.substring(currentProviderConfig.anthropic_auth_token.length - 4)}` : 
          undefined
      };
    }

    // 如果没有匹配的自定义中转站，但有当前配置，显示基本信息
    if (currentProviderConfig.anthropic_base_url) {
      return {
        baseUrl: currentProviderConfig.anthropic_base_url,
        partialKey: currentProviderConfig.anthropic_auth_token ? 
          `${currentProviderConfig.anthropic_auth_token.substring(0, 8)}...${currentProviderConfig.anthropic_auth_token.substring(currentProviderConfig.anthropic_auth_token.length - 4)}` : 
          undefined
      };
    }

    return null;
  };

  const loadStations = async () => {
    try {
      setLoading(true);
      const stationsData = await api.listRelayStations();
      setStations(stationsData);
      
      // If we have a selectedStation, update it with the latest data to maintain consistency
      if (selectedStation) {
        const updatedStation = stationsData.find(s => s.id === selectedStation.id);
        if (updatedStation) {
          setSelectedStation(updatedStation);
        }
      }
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
        key={selectedStation.id}
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

      {/* Current Applied Configuration Status */}
      {(() => {
        const appliedConfig = getAppliedConfigInfo();
        if (!appliedConfig) return null;

        return (
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                <h4 className="text-sm font-medium text-green-800 dark:text-green-200">当前应用的配置</h4>
              </div>
              <div className="space-y-1 text-xs text-green-700 dark:text-green-300">
                {appliedConfig.station ? (
                  <>
                    <p><span className="font-medium">中转站:</span> {appliedConfig.station.name}</p>
                    <p><span className="font-medium">类型:</span> {appliedConfig.station.adapter === 'custom' ? '自定义' : appliedConfig.station.adapter.toUpperCase()}</p>
                  </>
                ) : (
                  <p><span className="font-medium">来源:</span> 外部配置</p>
                )}
                <p><span className="font-medium">Base URL:</span> {appliedConfig.baseUrl}</p>
                {appliedConfig.partialKey && (
                  <p><span className="font-medium">API Token:</span> {appliedConfig.partialKey}</p>
                )}
              </div>
            </div>
          </Card>
        );
      })()}

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
        <div className="space-y-4">
          {stations.map((station) => (
            <Card key={station.id} className="hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between p-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Server className="h-5 w-5 text-muted-foreground" />
                      <h3 className="text-lg font-semibold">{station.name}</h3>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {station.adapter === 'custom' ? '自定义' : station.adapter.toUpperCase()}
                    </Badge>
                    {station.adapter === 'custom' && (
                      <Badge variant="secondary" className="text-xs bg-blue-50 dark:bg-blue-950/20">
                        仅配置切换
                      </Badge>
                    )}
                    {!station.enabled && (
                      <Badge variant="destructive" className="text-xs">
                        已禁用
                      </Badge>
                    )}
                    {station.adapter === 'custom' && isCustomStationApplied(station) && (
                      <Badge variant="default" className="text-xs bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                        <Shield className="h-3 w-3 mr-1" />
                        已应用
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p><span className="font-medium">描述: </span>{station.description || '无描述'}</p>
                    <p><span className="font-medium">API地址: </span>{station.api_url}</p>
                    {station.user_id && station.adapter !== 'custom' && (
                      <p><span className="font-medium">用户ID: </span>{station.user_id}</p>
                    )}
                    {station.adapter === 'custom' && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        <span className="font-medium">说明: </span>此配置可直接应用为代理商设置，无需管理令牌和日志
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {station.adapter === 'custom' && (
                    <Button
                      variant={isCustomStationApplied(station) ? "default" : "default"}
                      size="sm"
                      onClick={() => handleApplyStationFromList(station)}
                      className={isCustomStationApplied(station) ? "bg-green-600 hover:bg-green-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
                      disabled={isCustomStationApplied(station)}
                    >
                      {isCustomStationApplied(station) ? (
                        <>
                          <Shield className="h-4 w-4 mr-2" />
                          已应用
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-4 w-4 mr-2" />
                          应用配置
                        </>
                      )}
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStationClick(station)}
                  >
                    查看详情
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
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
      
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto">
            <Toast
              message={toastMessage.message}
              type={toastMessage.type}
              onDismiss={() => setToastMessage(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export { RelayStationManager };