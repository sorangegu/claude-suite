import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { 
  Save, 
  X, 
  Eye,
  EyeOff,
  Info
} from 'lucide-react';
import { type ProviderConfig } from '@/lib/api';
import { Toast } from '@/components/ui/toast';
import { useTranslation } from '@/hooks/useTranslation';

interface ProviderFormProps {
  initialData?: ProviderConfig;
  onSubmit: (formData: Omit<ProviderConfig, 'id'>) => Promise<void>;
  onCancel: () => void;
}

export default function ProviderForm({ 
  initialData, 
  onSubmit, 
  onCancel 
}: ProviderFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Omit<ProviderConfig, 'id'>>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    base_url: initialData?.base_url || '',
    auth_token: initialData?.auth_token || '',
    api_key: initialData?.api_key || '',
    model: initialData?.model || '',
  });
  
  const [loading, setLoading] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const isEditing = !!initialData;

  const handleInputChange = (field: keyof Omit<ProviderConfig, 'id'>, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value || undefined // 将空字符串转换为 undefined
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return t('common.pleaseEnterProviderName');
    }
    if (!formData.base_url.trim()) {
      return t('common.pleaseEnterApiAddress');
    }
    if (!formData.base_url.startsWith('http://') && !formData.base_url.startsWith('https://')) {
      return t('common.apiAddressMustStartWith');
    }
    if (!formData.auth_token?.trim() && !formData.api_key?.trim()) {
      return t('common.pleaseEnterAuthTokenOrApiKey');
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const error = validateForm();
    if (error) {
      setToastMessage({ message: error, type: 'error' });
      return;
    }

    try {
      setLoading(true);
      
      const submitData: Omit<ProviderConfig, 'id'> = {
        ...formData,
        // 清理空值
        auth_token: formData.auth_token?.trim() || undefined,
        api_key: formData.api_key?.trim() || undefined,
        model: formData.model?.trim() || undefined,
      };

      await onSubmit(submitData);
      
    } catch (error) {
      console.error('Failed to save provider config:', error);
      setToastMessage({ 
        message: t('common.addOrUpdateProviderFailed', { 
          action: t(isEditing ? 'common.updating' : 'common.adding'),
          error: error
        }), 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onCancel();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-4 space-y-4">
            {/* 基本信息 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Info className="h-4 w-4" />
                {t('common.basicInfo')}
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('common.providerNameRequired')}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder={t('common.providerNamePlaceholder')}
                    disabled={loading}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">{t('common.providerDescription')}</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder={t('common.descriptionPlaceholder')}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="base_url">{t('common.apiAddressRequired')}</Label>
                <Input
                  id="base_url"
                  value={formData.base_url}
                  onChange={(e) => handleInputChange('base_url', e.target.value)}
                  placeholder={t('common.apiAddressPlaceholder')}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* 认证信息 */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Eye className="h-4 w-4" />
                {t('common.authenticationInfo')}
                <span className="text-xs text-muted-foreground ml-2">
                  {t('common.atLeastOneRequired')}
                </span>
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="auth_token">{t('common.authToken')}</Label>
                  <div className="relative">
                    <Input
                      id="auth_token"
                      type={showTokens ? "text" : "password"}
                      value={formData.auth_token || ''}
                      onChange={(e) => handleInputChange('auth_token', e.target.value)}
                      placeholder={t('common.authTokenPlaceholder')}
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-8 w-8 p-0"
                      onClick={() => setShowTokens(!showTokens)}
                    >
                      {showTokens ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api_key">{t('common.apiKey')}</Label>
                  <div className="relative">
                    <Input
                      id="api_key"
                      type={showTokens ? "text" : "password"}
                      value={formData.api_key || ''}
                      onChange={(e) => handleInputChange('api_key', e.target.value)}
                      placeholder={t('common.apiKeyPlaceholder')}
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-8 w-8 p-0"
                      onClick={() => setShowTokens(!showTokens)}
                    >
                      {showTokens ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">{t('common.modelName')}</Label>
                  <Input
                    id="model"
                    value={formData.model || ''}
                    onChange={(e) => handleInputChange('model', e.target.value)}
                    placeholder={t('common.modelNamePlaceholder')}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('common.someProvidersRequireModel')}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              {t('buttons.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isEditing ? t('common.updatingConfig') : t('common.addingConfig')}
                </div>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? t('common.updateConfig') : t('common.addConfig')}
                </>
              )}
            </Button>
          </div>
        
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
      </form>
  );
}