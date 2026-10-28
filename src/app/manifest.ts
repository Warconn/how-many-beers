import type {MetadataRoute} from 'next';
export const dynamic='force-static';
export default function manifest():MetadataRoute.Manifest{
  const base=process.env.NEXT_PUBLIC_BASE_PATH??'';
  return {id:base+'/',name:'How Many Beers?',short_name:'How Many Beers?',
    description:'Plan every dish. Time your dinner. Enjoy the cook.',
    start_url:base+'/',scope:base+'/',display:'standalone',background_color:'#F7F5F0',theme_color:'#282722',
    icons:[192,512].map(size=>({src:`${base}/brand/icon-${size}.png`,sizes:`${size}x${size}`,type:'image/png',purpose:'any'}))};
}
