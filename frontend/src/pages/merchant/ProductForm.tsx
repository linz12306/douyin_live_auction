import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createProduct, getProduct, updateProduct, uploadProductImage, publishProduct } from '../../api/product';
import ImageUploader from '../../components/ImageUploader';
import AuctionRuleForm from '../../components/AuctionRuleForm';
import type { PublishRequest } from '../../types/product';

export default function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [rules, setRules] = useState<PublishRequest>({
    start_price: 0, bid_increment_type: 'fixed', bid_increment_value: 10,
    ceiling_price: null, duration_seconds: 300, auto_extend_seconds: 15, max_extend_count: 5,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (isEdit && id) {
      getProduct(parseInt(id)).then((detail) => {
        setTitle(detail.product.title);
        setDescription(detail.product.description);
        setImages(detail.images.map((img) => img.image_url));
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
  }, [id]);

  const handleSave = async () => {
    setError('');
    setLoading(true);
    try {
      if (isEdit) {
        await updateProduct(parseInt(id!), title, description);
      } else {
        const result = await createProduct(title, description, images);
        await publishProduct(result.product.id, rules);
      }
      navigate('/merchant/products');
    } catch (err: any) {
      setError(err.response?.data?.message || '保存失败');
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
    } catch (err: any) {
      setError(err.response?.data?.message || '发布失败');
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
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setImages([...images, url]);
        resolve(url);
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">{isEdit ? '编辑商品' : '新建竞拍'}</h1>

        {error && (
          <div className="bg-red-500/20 border border-red-400 text-red-200 rounded-lg p-3 mb-4 text-sm">{error}</div>
        )}

        <div className="space-y-6">
          {/* Product Info */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h3 className="text-white font-semibold mb-4">商品信息</h3>
            <div className="space-y-4">
              <input
                type="text" placeholder="商品名称" value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-purple-400"
              />
              <textarea
                placeholder="商品介绍（可选）" value={description}
                onChange={(e) => setDescription(e.target.value)} rows={4}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-purple-400 resize-none"
              />
              <div>
                <label className="text-white/70 text-sm block mb-2">商品图片</label>
                <ImageUploader
                  images={images}
                  onAdd={handleAddImage}
                  onRemove={(i) => setImages(images.filter((_, idx) => idx !== i))}
                  readonly={status !== 'draft' && status !== ''}
                />
              </div>
            </div>
          </div>

          {/* Auction Rules */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <AuctionRuleForm value={rules} onChange={setRules} />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {isEdit && status === 'draft' ? (
              <button onClick={handlePublish} disabled={loading}
                className="flex-1 py-3 bg-green-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                发布到待开拍
              </button>
            ) : null}
            <button onClick={handleSave} disabled={loading}
              className="flex-1 py-3 bg-purple-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50">
              {isEdit ? '保存修改' : '创建草稿'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
