import React from 'react';

import { Html } from '../types';
import { LayoutProps, OrganismProps, route, useOrganismStatus } from './atomic';

export function PageLayout(props: LayoutProps<'header' | 'footer'>) {
  return (
    <div>
      <header>{props.header}</header>
      <main>{props.children}</main>
      <footer>{props.footer}</footer>
    </div>
  );
}

export function ContentLayout(props: LayoutProps<'intro' | 'body'>) {
  return (
    <div>
      <div>{props.intro}</div>
      <div>{props.body}</div>
    </div>
  );
}

export function Header() {
  return <div>Header</div>;
}

export function Footer() {
  return <div>Footer</div>;
}

export function ContentHeader(props: OrganismProps<{ title: string }>) {
  return <h1>{props.title}</h1>;
}

export function SyncContent(props: OrganismProps<{ Content: Html }>) {
  return <props.Content />;
}

export function AsyncContent(props: OrganismProps<{ Content: Html }>) {
  const status = useOrganismStatus();
  return status === 200 ? <props.Content /> : <p>Loading ...</p>;
}

export const Page = route(PageLayout, {
  header: Header,
  footer: Footer,
});

export const Content = route(ContentLayout, {
  intro: ContentHeader,
  body: {
    sync: SyncContent,
    async: AsyncContent,
  },
});