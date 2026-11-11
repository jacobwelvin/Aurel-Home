import React from "react";
import { notFound } from "next/navigation";
import { fetchProductBySlug, fetchRelatedProducts } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/utils";
import { ProductDetailsClient } from "./ProductDetailsClient";
import type { Metadata } from "next";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    return {
      title: "Product Not Found | AUREL HOME",
    };
  }

  return {
    title: `${product.name} | AUREL HOME`,
    description: product.description.slice(0, 160),
    openGraph: {
      title: `${product.name} | AUREL HOME`,
      description: product.description.slice(0, 160),
      images: [{ url: resolveMediaUrl(product.images[0]) }],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = await fetchRelatedProducts(product.slug, product.categorySlug, 4);

  return <ProductDetailsClient product={product} relatedProducts={relatedProducts} />;
}
