import type {SVGProps} from 'react';
/** One quiet, round-stroke family. Icons supplement visible text or a named control. */
const paths={
 grip:<><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></>,
 history:<><path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7"/><path d="M12 7v5l3 2"/></>,
 'arrow-up':<path d="m6 10 6-6 6 6M12 4v16"/>,
 'arrow-down':<path d="m6 14 6 6 6-6M12 4v16"/>,
 'arrow-left':<path d="m10 6-6 6 6 6M4 12h16"/>,
 'arrow-right':<path d="m14 6 6 6-6 6M4 12h16"/>,
 'chevron-up':<path d="m6 15 6-6 6 6"/>,
 'chevron-down':<path d="m6 9 6 6 6-6"/>,
 'chevron-right':<path d="m9 6 6 6-6 6"/>,
 plus:<path d="M12 5v14M5 12h14"/>,
 close:<path d="m6 6 12 12M6 18 18 6"/>,
 trash:<path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/>,
 check:<path d="m5 12 4 4L19 6"/>,
 external:<path d="M14 3h7v7M21 3 10 14M10 3H3v18h18v-7"/>,
 user:<><circle cx="12" cy="8" r="3.5"/><path d="M4.5 21v-2.5a7.5 7.5 0 0 1 15 0V21"/></>,
 'cloud-check':<><path d="M7 18H6a4 4 0 0 1-.6-7.96A6 6 0 0 1 17 7a5 5 0 0 1 1 9.9"/><path d="m9 17 3 3 6-6"/></>,
 sync:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.6-1.2L20 8M4 16l2.3 2.2A7 7 0 0 0 17.9 17"/></>,
 alert:<><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v4m0 4h.01"/></>,
};
export type IconName=keyof typeof paths;
export default function Icon({name,className='',...props}:{name:IconName}&SVGProps<SVGSVGElement>){
 return <svg {...props} className={'ui-icon '+className} data-icon={name} aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
