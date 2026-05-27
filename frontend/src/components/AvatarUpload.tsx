import { useRef, useState } from 'react';

interface Props {
  currentUrl: string;
  onUpload: (file: File) => Promise<string>;
}

export default function AvatarUpload({ currentUrl, onUpload }: Props) {
  const [preview, setPreview] = useState(currentUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('仅支持 jpg/png/webp');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('文件不能超过 2MB');
      return;
    }

    setError('');
    setUploading(true);
    try {
      const newUrl = await onUpload(file);
      setPreview(newUrl);
    } catch {
      setError('上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/30 overflow-hidden cursor-pointer relative group"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="头像" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/40 text-3xl">
            +
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
          <span className="text-white text-xs">{uploading ? '上传中...' : '更换'}</span>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
