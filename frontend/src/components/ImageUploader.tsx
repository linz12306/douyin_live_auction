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
          <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-white/5 border border-white/20">
            <img src={url} alt="" className="w-full h-full object-cover" />
            {!readonly && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 transition"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {!readonly && images.length < 9 && (
          <div
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-white/30 flex items-center justify-center cursor-pointer hover:border-purple-400 transition bg-white/5"
          >
            <span className="text-white/40 text-3xl">{uploading ? '...' : '+'}</span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
