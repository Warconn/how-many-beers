import type {ReactNode} from 'react';
import Icon from './Icon';

type RemoveAction={label:string;onClick:()=>void;disabled?:boolean};
type ItemHeading={title:ReactNode;metadata:ReactNode;count:number;remove:RemoveAction};
export type LibraryItem=ItemHeading&{id:string;actions:ReactNode};

/** Shared summary and contextual removal placement for lists and their details. */
export function LibraryItemHeading({title,metadata,count,remove}:ItemHeading){
  return <div className="between library-item-heading">
    <div className="library-item-title">{title}</div>
    <div className="library-item-tools">
      <span className="history-count">{count} steps</span>
      <button type="button" className="plan-trash library-trash" aria-label={remove.label} title={remove.label} disabled={remove.disabled} onClick={remove.onClick}><Icon name="trash"/></button>
    </div>
    <p className="muted small library-item-metadata">{metadata}</p>
  </div>;
}

/** Presentation only: callers retain ownership, confirmation and persistence. */
export default function LibraryList({items,label,emptyMessage,className=''}:{items:LibraryItem[];label:string;emptyMessage:string;className?:string}){
  return <ul className={'library-list history-list '+className} aria-label={label}>
    {items.map(({id,actions,...heading})=><li className="library-card history-item" key={id}>
      <LibraryItemHeading {...heading}/>
      <div className="library-card-actions history-actions">{actions}</div>
    </li>)}
    {!items.length&&<li className="muted small">{emptyMessage}</li>}
  </ul>;
}
