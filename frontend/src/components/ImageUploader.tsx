import { useRef, useState } from 'react';

interface Props {
  images: string[];
  onAdd: (file: File) => Promise<string>;
  onRemove: (index: number) => void;
  readonly?: boolean;
}

export default function ImageUploader({ images, onAdd, onRemove, readonly }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('仅支持 jpg/png/webp');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('图片不能超过 2MB');
      return;
    }

    setError('');
    setUploading(true);
    try {
      await onAdd(file);
    } catch {
      setError('上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        {images.map((url, i) => (
          <div key={i} className="group relative aspect-square overflow-hidden rounded-md border border-[#263241] bg-[#0B1016]">
            <img src={url} alt="" className="w-full h-full object-cover" />
            {!readonly && (
              <button
                type="button"
                aria-label={`删除第 ${i + 1} 张商品图片`}
                onClick={() => onRemove(i)}
                className="absolute right-1 top-1 h-6 w-6 rounded-md bg-[#F05268] text-xs font-black text-white opacity-0 transition hover:bg-[#FF6B7D] focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#FFB4BE] group-hover:opacity-100"
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
        ))}
        {!readonly && images.length < 9 && (
          <button
            type="button"
            aria-label="添加商品图片"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square items-center justify-center rounded-md border border-dashed border-[#384553] bg-[#0B1016] transition hover:border-[#4BA3FF] hover:bg-[#131B24] focus:border-[#4BA3FF] focus:outline-none focus:ring-2 focus:ring-[#4BA3FF]/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span aria-hidden="true" className="text-3xl font-light text-[#596575]">{uploading ? '...' : '+'}</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
      {error && <p className="text-xs font-semibold text-[#FF8A9A]">{error}</p>}
    </div>
  );
}
