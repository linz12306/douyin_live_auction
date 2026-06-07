import { useState, useEffect } from 'react';
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
import ImageUploader from '../../components/ImageUploader';
import AuctionRuleForm from '../../components/AuctionRuleForm';
import PageBackButton from '../../components/PageBackButton';
import type { ProductLiveMedia, PublishRequest } from '../../types/product';

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
  const navigate = useNavigate();

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
  const canEditMedia = status === '' || status === 'draft';

  useEffect(() => {
    if (isEdit && id) {
      getProduct(parseInt(id)).then((detail) => {
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
      });
    }
  }, [id, isEdit]);

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
        await updateProduct(parseInt(id!), title, description);
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

  const handlePublish = async () => {
    if (!id) return;
    setError('');
    setLoading(true);
    try {
      await publishProduct(parseInt(id), rules);
      navigate(`/merchant/products/${id}`);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '发布失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddImage = async (file: File) => {
    if (id) {
      const url = await uploadProductImage(parseInt(id), file);
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
    if (id) {
      setLiveMediaUploading(true);
      try {
        const uploaded = await uploadProductLiveMedia(parseInt(id), file);
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
    if (id && liveMedia) {
      setLiveMediaUploading(true);
      try {
        await deleteProductLiveMedia(parseInt(id));
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

  return (
    <div className="min-h-screen bg-[#080b11] relative overflow-hidden text-white">
      {/* 背景光效 */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-600/3 blur-[120px] pointer-events-none" />

      <div className="max-w-2xl mx-auto px-4 py-8 relative z-10">
        <PageBackButton fallback="/merchant/products" className="mb-4 border-white/10 bg-white/5 hover:bg-white/10" />
        <h1 className="text-3xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent tracking-tight mb-6">{isEdit ? '编辑商品' : '新建竞拍'}</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl p-4 mb-6 text-sm flex items-center gap-2 backdrop-blur">
            <span className="shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Product Info */}
          <div className="bg-[#111422]/60 backdrop-blur-xl border border-white/8 rounded-2xl p-6 shadow-xl shadow-black/30">
            <h3 className="text-base font-bold text-slate-200 mb-4 flex items-center gap-2">
              <span className="text-purple-400">📦</span> 商品基本信息
            </h3>
            <div className="space-y-5">
              <div>
                <label className="text-xs text-slate-300 font-semibold mb-1.5 block">商品名称</label>
                <input
                  type="text" placeholder="请输入商品名称" value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/40 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 transition-all duration-200 text-sm shadow-inner shadow-black/10"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300 font-semibold mb-1.5 block">商品详情介绍（可选）</label>
                <textarea
                  placeholder="请输入商品材质、尺寸、成色等详情说明..." value={description}
                  onChange={(e) => setDescription(e.target.value)} rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/40 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 transition-all duration-200 text-sm shadow-inner shadow-black/10 resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300 font-semibold mb-2 block">商品展示图片</label>
                <ImageUploader
                  images={images}
                  onAdd={handleAddImage}
                  onRemove={handleRemoveImage}
                  readonly={!canEditMedia}
                />
              </div>
              <div className="border-t border-white/5 pt-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <label className="text-xs text-slate-200 font-bold block">直播间素材背景</label>
                    <p className="text-slate-400 text-[11px] mt-1">用于用户端直播间背景，支持图片或短视频</p>
                  </div>
                  {canEditMedia && (
                    <label className="shrink-0 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-white/90 text-xs font-bold cursor-pointer hover:border-purple-400 hover:bg-white/10 transition-all duration-200">
                      {previewURL ? '替换素材' : '选择素材'}
                      <input
                        aria-label="上传直播间素材"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                        className="hidden"
                        onChange={handleLiveMediaFile}
                        disabled={liveMediaUploading}
                      />
                    </label>
                  )}
                </div>
                {previewURL ? (
                  <div className="relative overflow-hidden rounded-xl border border-white/5 bg-slate-950 aspect-video max-w-md shadow-inner">
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
                        className="absolute top-2 right-2 rounded-xl bg-red-600/90 hover:bg-red-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg shadow-black/45 backdrop-blur transition-colors duration-200 disabled:opacity-50"
                      >
                        删除素材
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/20 px-4 py-5 text-xs text-slate-500/90 leading-relaxed">
                    未上传自定义素材时将使用系统预设直播间场景。上传后，用户进入直播间将优先看到您配置的高清画面/视频。
                  </div>
                )}
                {liveMediaError && <p className="text-rose-400 text-xs mt-2 font-semibold">⚠️ {liveMediaError}</p>}
              </div>
            </div>
          </div>

          {/* Auction Rules */}
          <div className="bg-[#111422]/60 backdrop-blur-xl border border-white/8 rounded-2xl p-6 shadow-xl shadow-black/30">
            <AuctionRuleForm value={rules} onChange={setRules} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {isEdit && status === 'draft' ? (
              <button onClick={handlePublish} disabled={loading}
                className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black rounded-xl hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98] transition-all duration-200 text-sm disabled:opacity-50 disabled:scale-100 shadow-lg shadow-emerald-500/10">
                发布到待开拍
              </button>
            ) : null}
            <button onClick={handleSave} disabled={loading}
              className="flex-1 py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold rounded-xl hover:from-violet-500 hover:to-purple-500 active:scale-[0.98] transition-all duration-200 text-sm disabled:opacity-50 disabled:scale-100 shadow-lg shadow-purple-500/15">
              {isEdit ? '保存修改' : '创建草稿'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getLiveMediaType(file: File): 'image' | 'video' | null {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'image';
  if (['video/mp4', 'video/webm'].includes(file.type)) return 'video';
  return null;
}
