export function pageHead(titulo: string, descripcion: string) {
  const title = `${titulo} — AgroMatch COMEX`;
  return {
    meta: [
      { title },
      { name: "description", content: descripcion },
      { property: "og:title", content: title },
      { property: "og:description", content: descripcion },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}
