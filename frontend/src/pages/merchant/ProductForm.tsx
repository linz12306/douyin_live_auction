import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createProduct,
  deleteProductLiveMedia,
  getProduct,
  publishProduct,
  updateProduct,
  uploadProductImage,
  uploadProductLiveMedia,
} from '../../api/product';
import { generateProductCopy } from '../../api/ai';
import ImageUploader from '../../components/ImageUploader';
import AuctionRuleForm from '../../components/AuctionRuleForm';
import MerchantConsole from '../../components/merchant/MerchantConsole';
import { ConsolePanel } from '../../components/merchant/MerchantPrimitives';
import PageBackButton from '../../components/PageBackButton';
import type { ProductLiveMedia, PublishRequest } from '../../types/product';
import type { ProductCopyDraft } from '../../types/ai';

function getApiErrorMessage(err: unknown, fallback: string) {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return fallback;
}

export default function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const productId = id ? Number(id) : undefined;
  const hasValidProductId = Number.isInteger(productId) && (productId ?? 0) > 0;
  const isValidEditProductId = !isEdit || hasValidProductId;
  const navigate = useNavigate();
  const liveMediaInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [liveMedia, setLiveMedia] = useState<ProductLiveMedia | null>(null);
  const [pendingLiveMedia, setPendingLiveMedia] = useState<File | null>(null);
  const [pendingLiveMediaType, setPendingLiveMediaType] = useState<'image' | 'video' | null>(null);
  const [liveMediaPreviewURL, setLiveMediaPreviewURL] = useState('');
  const [liveMediaError, setLiveMediaError] = useState('');
  const [liveMediaUploading, setLiveMediaUploading] = useState(false);
  const [rules, setRules] = useState<PublishRequest>({
    start_price: 0, bid_increment_type: 'fixed', bid_increment_value: 10,
    ceiling_price: null, duration_seconds: 300, auto_extend_seconds: 15, max_extend_count: 5,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [aiLoading, setAILoading] = useState(false);
  const [aiError, setAIError] = useState('');
  const [aiDraft, setAIDraft] = useState<ProductCopyDraft | null>(null);
  const canEditMedia = status === '' || status === 'draft';

  useEffect(() => {
    if (!isEdit || !isValidEditProductId || productId === undefined) return;

    let ignore = false;

    getProduct(productId)
      .then((detail) => {
        if (ignore) return;
        setTitle(detail.product.title);
        setDescription(detail.product.description);
        setImages(detail.images.map((img) => img.image_url));
        setLiveMedia(detail.live_media ?? null);
        setStatus(detail.product.status);
        if (detail.auction) {
          setRules({
            start_price: detail.auction.start_price,
            bid_increment_type: detail.auction.bid_increment_type,
            bid_increment_value: detail.auction.bid_increment_value,
            ceiling_price: detail.auction.ceiling_price,
            duration_seconds: detail.auction.duration_seconds,
            auto_extend_seconds: detail.auction.auto_extend_seconds,
            max_extend_count: detail.auction.max_extend_count,
          });
        }
      })
      .catch(() => {
        if (!ignore) setError('商品详情加载失败');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [isEdit, isValidEditProductId, productId]);

  useEffect(() => {
    return () => {
      if (liveMediaPreviewURL.startsWith('blob:')) {
        URL.revokeObjectURL(liveMediaPreviewURL);
      }
    };
  }, [liveMediaPreviewURL]);

  const handleSave = async () => {
    setError('');
    setLoading(true);
    try {
      if (isEdit) {
        if (!hasValidProductId || productId === undefined) {
          setError('商品不存在');
          return;
        }
        await updateProduct(productId, title, description);
      } else {
        if (pendingFiles.length === 0) {
          setError('请至少上传一张商品图片');
          return;
        }
        const result = await createProduct(title, description, []);
        for (const file of pendingFiles) {
          await uploadProductImage(result.product.id, file);
        }
        if (pendingLiveMedia) {
          await uploadProductLiveMedia(result.product.id, pendingLiveMedia);
        }
        await publishProduct(result.product.id, rules);
      }
      navigate('/merchant/products');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '保存失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAICopy = async () => {
    setAIError('');
    setAILoading(true);
    try {
      const result = await generateProductCopy({
        title,
        description,
        start_price: rules.start_price,
        bid_increment_type: rules.bid_increment_type,
        bid_increment_value: rules.bid_increment_value,
        ceiling_price: rules.ceiling_price ?? null,
        duration_seconds: rules.duration_seconds,
      });
      setAIDraft(result.draft);
    } catch (err: unknown) {
      setAIError(getApiErrorMessage(err, 'AI文案生成失败，请检查模型配置后重试'));
    } finally {
      setAILoading(false);
    }
  };

  const handleApplyAIDraft = () => {
    if (!aiDraft) return;
    setTitle(aiDraft.title);
    setDescription(formatAIDescription(aiDraft));
  };

  const handlePublish = async () => {
    if (!hasValidProductId || productId === undefined) return;
    setError('');
    setLoading(true);
    try {
      await publishProduct(productId, rules);
      navigate(`/merchant/products/${productId}`);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '发布失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddImage = async (file: File) => {
    if (isEdit) {
      if (!hasValidProductId || productId === undefined) throw new Error('商品不存在');
      const url = await uploadProductImage(productId, file);
      setImages([...images, url]);
      return url;
    }
    const previewURL = URL.createObjectURL(file);
    setImages([...images, previewURL]);
    setPendingFiles([...pendingFiles, file]);
    return previewURL;
  };

  const handleRemoveImage = (index: number) => {
    const removed = images[index];
    if (removed?.startsWith('blob:')) {
      URL.revokeObjectURL(removed);
    }
    setImages(images.filter((_, idx) => idx !== index));
    if (!id) {
      setPendingFiles(pendingFiles.filter((_, idx) => idx !== index));
    }
  };

  const handleLiveMediaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const type = getLiveMediaType(file);
    if (!type) {
      setLiveMediaError('仅支持 jpg/png/webp/mp4/webm');
      return;
    }
    const maxSize = type === 'video' ? 20 * 1024 * 1024 : 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setLiveMediaError(type === 'video' ? '视频不能超过 20MB' : '图片不能超过 2MB');
      return;
    }

    setLiveMediaError('');
    if (isEdit) {
      if (!hasValidProductId || productId === undefined) {
        setLiveMediaError('商品不存在');
        return;
      }
      setLiveMediaUploading(true);
      try {
        const uploaded = await uploadProductLiveMedia(productId, file);
        setLiveMedia(uploaded);
        setPendingLiveMedia(null);
        setPendingLiveMediaType(null);
        setLiveMediaPreviewURL('');
      } catch (err: unknown) {
        setLiveMediaError(getApiErrorMessage(err, '直播间素材上传失败'));
      } finally {
        setLiveMediaUploading(false);
      }
      return;
    }

    const previewURL = URL.createObjectURL(file);
    setLiveMedia((current) => {
      if (current?.url.startsWith('blob:')) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
    if (liveMediaPreviewURL.startsWith('blob:')) {
      URL.revokeObjectURL(liveMediaPreviewURL);
    }
    setLiveMediaPreviewURL(previewURL);
    setPendingLiveMedia(file);
    setPendingLiveMediaType(type);
  };

  const handleRemoveLiveMedia = async () => {
    setLiveMediaError('');
    if (isEdit && liveMedia) {
      if (!hasValidProductId || productId === undefined) {
        setLiveMediaError('商品不存在');
        return;
      }
      setLiveMediaUploading(true);
      try {
        await deleteProductLiveMedia(productId);
        setLiveMedia(null);
      } catch (err: unknown) {
        setLiveMediaError(getApiErrorMessage(err, '直播间素材删除失败'));
      } finally {
        setLiveMediaUploading(false);
      }
      return;
    }
    if (liveMediaPreviewURL.startsWith('blob:')) {
      URL.revokeObjectURL(liveMediaPreviewURL);
    }
    setLiveMediaPreviewURL('');
    setPendingLiveMedia(null);
    setPendingLiveMediaType(null);
  };

  const previewURL = liveMedia?.url ?? liveMediaPreviewURL;
  const previewType = liveMedia?.type ?? pendingLiveMediaType;

  if (!isValidEditProductId) {
    return (
      <MerchantConsole
        title="编辑商品"
        eyebrow="直播商品"
        description="未找到可编辑的商品记录"
        actions={<PageBackButton fallback="/merchant/products" className="border-[#384553] bg-[#0F151C] hover:bg-[#182331]" />}
      >
        <div className="mx-auto max-w-7xl">
          <ConsolePanel className="py-20 text-center text-[#8B97A7]">
            <p className="text-sm font-medium">商品不存在</p>
          </ConsolePanel>
        </div>
      </MerchantConsole>
    );
  }

  return (
    <MerchantConsole
      title={isEdit ? '编辑商品' : '新建竞拍'}
      eyebrow="直播商品"
      description={isEdit ? '更新商品信息、素材与竞拍参数' : '创建商品草稿并配置待开拍规则'}
      actions={
        <PageBackButton fallback="/merchant/products" className="border-[#384553] bg-[#0F151C] hover:bg-[#182331]" />
      }
    >
      <div className="mx-auto max-w-7xl">
        {error && (
          <div className="mb-4 rounded-lg border border-[#F05268]/35 bg-[#F05268]/10 p-4 text-sm font-semibold text-[#FF8A9A]">
            {error}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)]">
          <div className="space-y-4">
            <ConsolePanel className="p-4">
              <div className="mb-4">
                <h2 className="text-sm font-black text-white">商品身份</h2>
                <p className="mt-1 text-xs font-medium text-[#8B97A7]">用于商品列表、详情页与直播间展示</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label htmlFor="product-title" className="mb-1.5 block text-xs font-semibold text-[#B2BECC]">
                    商品名称
                  </label>
                  <input
                    id="product-title"
                    type="text"
                    placeholder="请输入商品名称"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-md border border-[#384553] bg-[#0B1016] px-4 py-3 text-sm text-white outline-none placeholder:text-[#596575] focus:border-[#4BA3FF] focus:ring-2 focus:ring-[#4BA3FF]/20"
                  />
                </div>
                <div>
                  <label htmlFor="product-description" className="mb-1.5 block text-xs font-semibold text-[#B2BECC]">
                    商品详情介绍（可选）
                  </label>
                  <textarea
                    id="product-description"
                    placeholder="请输入商品材质、尺寸、成色等详情说明..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-md border border-[#384553] bg-[#0B1016] px-4 py-3 text-sm text-white outline-none placeholder:text-[#596575] focus:border-[#4BA3FF] focus:ring-2 focus:ring-[#4BA3FF]/20"
                  />
                </div>
              </div>
            </ConsolePanel>

            <ConsolePanel className="p-4">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black text-white">AI 商品文案助手</h2>
                  <p className="mt-1 text-xs font-medium text-[#8B97A7]">根据当前商品信息和竞拍规则生成草稿，确认后再填入表单</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleGenerateAICopy()}
                  disabled={aiLoading}
                  className="rounded-md border border-[#4BA3FF]/35 bg-[#4BA3FF]/10 px-3 py-2 text-xs font-black text-[#9CCBFF] transition hover:bg-[#4BA3FF]/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {aiLoading ? '生成中...' : '生成AI文案'}
                </button>
              </div>
              {aiError ? (
                <div className="rounded-md border border-[#F05268]/35 bg-[#F05268]/10 px-3 py-2 text-xs font-semibold text-[#FF8A9A]">
                  {aiError}
                </div>
              ) : null}
              {aiDraft ? (
                <div className="space-y-3 rounded-lg border border-[#263241] bg-[#0B1016] p-3">
                  <div>
                    <div className="text-[11px] font-semibold text-[#596575]">标题草稿</div>
                    <div className="mt-1 text-sm font-black text-white">{aiDraft.title}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-[#596575]">介绍草稿</div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#D5DCE5]">{aiDraft.description}</p>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-[#596575]">卖点</div>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#D5DCE5]">
                      {aiDraft.selling_points.map((point) => <li key={point}>{point}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-[#596575]">直播口播</div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#D5DCE5]">{aiDraft.live_script}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyAIDraft}
                    className="w-full rounded-md bg-[#21D19F] px-4 py-2.5 text-sm font-black text-[#07100D] transition hover:bg-[#76F2CD]"
                  >
                    应用到商品表单
                  </button>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-[#263241] bg-[#0B1016] px-4 py-5 text-xs leading-relaxed text-[#8B97A7]">
                  AI 只生成草稿，不会自动保存或覆盖商品。生成结果来自已配置的大模型。
                </div>
              )}
            </ConsolePanel>

            <ConsolePanel className="p-4">
              <div className="mb-4">
                <h2 className="text-sm font-black text-white">商品图库</h2>
                <p className="mt-1 text-xs font-medium text-[#8B97A7]">最多展示 9 张商品图，草稿阶段可调整</p>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold text-[#B2BECC]">商品展示图片</label>
                <ImageUploader
                  images={images}
                  onAdd={handleAddImage}
                  onRemove={handleRemoveImage}
                  readonly={!canEditMedia}
                />
              </div>
            </ConsolePanel>

            <ConsolePanel className="p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black text-white">直播间素材</h2>
                  <p className="mt-1 text-xs font-medium text-[#8B97A7]">用于用户端直播间背景，支持图片或短视频</p>
                </div>
                {canEditMedia && (
                  <>
                    <button
                      type="button"
                      onClick={() => liveMediaInputRef.current?.click()}
                      disabled={liveMediaUploading}
                      className="shrink-0 rounded-md border border-[#384553] bg-[#0F151C] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#182331] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {previewURL ? '替换素材' : '选择素材'}
                    </button>
                    <input
                      ref={liveMediaInputRef}
                      aria-label="上传直播间素材"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                      className="hidden"
                      onChange={handleLiveMediaFile}
                      disabled={liveMediaUploading}
                    />
                  </>
                )}
              </div>
              {previewURL ? (
                <div className="relative aspect-video max-w-2xl overflow-hidden rounded-md border border-[#263241] bg-[#0B1016]">
                  {previewType === 'video' ? (
                    <video src={previewURL} poster={liveMedia?.poster_url ?? undefined} className="h-full w-full object-cover" controls muted />
                  ) : (
                    <img src={previewURL} alt="直播间素材预览" className="h-full w-full object-cover" />
                  )}
                  {canEditMedia && (
                    <button
                      type="button"
                      onClick={handleRemoveLiveMedia}
                      disabled={liveMediaUploading}
                      className="absolute right-2 top-2 rounded-md bg-[#F05268] px-3 py-1.5 text-[11px] font-bold text-white shadow-lg shadow-black/45 transition hover:bg-[#FF6B7D] disabled:opacity-50"
                    >
                      删除素材
                    </button>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-[#263241] bg-[#0B1016] px-4 py-6 text-xs leading-relaxed text-[#8B97A7]">
                  未上传自定义素材时将使用系统预设直播间场景。上传后，用户进入直播间将优先看到您配置的高清画面/视频。
                </div>
              )}
              {liveMediaError && <p className="mt-2 text-xs font-semibold text-[#FF8A9A]">{liveMediaError}</p>}
            </ConsolePanel>
          </div>

          <div className="space-y-4">
            <ConsolePanel className="p-4">
              <AuctionRuleForm value={rules} onChange={setRules} />
            </ConsolePanel>

            <ConsolePanel className="p-4">
              <div className="mb-3">
                <h2 className="text-sm font-black text-white">动作</h2>
                <p className="mt-1 text-xs font-medium text-[#8B97A7]">保存商品信息或将草稿发布为待开拍</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                {isEdit && status === 'draft' ? (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={loading}
                    className="flex-1 rounded-md bg-[#21D19F] px-4 py-3 text-sm font-black text-[#07100D] transition hover:bg-[#76F2CD] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    发布到待开拍
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 rounded-md border border-[#4BA3FF]/35 bg-[#4BA3FF]/10 px-4 py-3 text-sm font-black text-[#9CCBFF] transition hover:bg-[#4BA3FF]/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isEdit ? '保存修改' : '创建草稿'}
                </button>
              </div>
            </ConsolePanel>
          </div>
        </div>
      </div>
    </MerchantConsole>
  );
}

function getLiveMediaType(file: File): 'image' | 'video' | null {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'image';
  if (['video/mp4', 'video/webm'].includes(file.type)) return 'video';
  return null;
}

function formatAIDescription(draft: ProductCopyDraft) {
  const sellingPoints = draft.selling_points.map((point) => `- ${point}`).join('\n');
  return `${draft.description}\n\n核心卖点：\n${sellingPoints}\n\n直播口播：\n${draft.live_script}`;
}
