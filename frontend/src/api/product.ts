import client from './client';
import type { ProductDetail, ProductListResponse, PublishRequest } from '../types/product';

export async function createProduct(title: string, description: string, imageUrls: string[]): Promise<ProductDetail> {
  const { data } = await client.post('/products', { title, description, image_urls: imageUrls });
  return data.data;
}

export async function getProduct(id: number): Promise<ProductDetail> {
  const { data } = await client.get(`/products/${id}`);
  return data.data;
}

export async function listProducts(status?: string, page = 1, size = 20): Promise<ProductListResponse> {
  const { data } = await client.get('/products', { params: { status, page, size } });
  return { ...data.data, items: data.data.items ?? [] };
}

export async function updateProduct(id: number, title: string, description: string): Promise<ProductDetail> {
  const { data } = await client.put(`/products/${id}`, { title, description });
  return data.data;
}

export async function deleteProduct(id: number): Promise<void> {
  await client.delete(`/products/${id}`);
}

export async function publishProduct(id: number, req: PublishRequest): Promise<ProductDetail> {
  const { data } = await client.post(`/products/${id}/publish`, req);
  return data.data;
}

export async function uploadProductImage(productId: number, file: File): Promise<string> {
  const form = new FormData();
  form.append('image', file);
  const { data } = await client.post(`/products/${productId}/images`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data.image_url;
}

export async function deleteProductImage(productId: number, imageId: number): Promise<void> {
  await client.delete(`/products/${productId}/images/${imageId}`);
}
