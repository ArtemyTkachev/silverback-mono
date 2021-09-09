import { render, screen } from '@testing-library/react';
import { GatsbyLinkProps } from 'gatsby';
import React from 'react';

import { buildLink } from '../gatsby';

const gatsbyNav = jest.fn();

type gatsby = {
  Link: (props: GatsbyLinkProps<any>) => JSX.Element;
  navigate: (to: string) => Promise<void>;
};

jest.mock(
  'gatsby',
  (): gatsby => ({
    Link: ({ children, to, activeClassName, ...props }) => (
      <a href={to} data-gatsby={true} {...props}>
        {children}
      </a>
    ),
    navigate: (to: string) => gatsbyNav(to),
  }),
);
beforeEach(jest.resetAllMocks);

describe('buildLink', () => {
  it('can build a link from segments and query parameters', () => {
    const Link = buildLink({
      segments: ['/foo', 'bar'],
      query: {
        a: 'b',
      },
    });
    render(<Link>Test</Link>);
    expect(screen.getByRole('link').getAttribute('data-gatsby')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toEqual(
      '/foo/bar?a=b',
    );
  });

  it('allows the consumer to set query parameters', () => {
    const Link = buildLink({
      href: '/foo',
    });
    render(<Link query={{ a: 'b' }}>Test</Link>);
    expect(screen.getByRole('link').getAttribute('href')).toEqual('/foo?a=b');
  });

  it('allows the consumer to set a query fragment', () => {
    const Link = buildLink({
      href: '/foo',
    });
    render(<Link fragment="bar">Test</Link>);
    expect(screen.getByRole('link').getAttribute('href')).toEqual('/foo#bar');
  });

  it('allows the consumer to set query parameters and fragments', () => {
    const Link = buildLink({
      href: '/foo',
    });
    render(
      <Link query={{ a: 'b' }} fragment="bar">
        Test
      </Link>,
    );
    expect(screen.getByRole('link').getAttribute('href')).toEqual(
      '/foo?a=b#bar',
    );
  });

  it('renders a Gatsby link for an internal path', () => {
    const Link = buildLink({ href: '/test' });
    render(<Link>Test</Link>);
    expect(screen.getByRole('link').getAttribute('data-gatsby')).toBeTruthy();
  });

  it('renders normal link for an external path', () => {
    const Link = buildLink({ href: 'http://www.amazeelabs.com' });
    render(<Link>Test</Link>);
    expect(screen.getByRole('link').getAttribute('data-gatsby')).toBeFalsy();
  });

  it('renders normal link for an external target', () => {
    const Link = buildLink({
      href: 'http://www.amazeelabs.com',
      target: '_blank',
    });
    render(<Link>Test</Link>);
    expect(screen.getByRole('link').getAttribute('data-gatsby')).toBeFalsy();
  });

  it('renders normal link for an mailto address', () => {
    const Link = buildLink({
      href: 'mailto:development@amazeelabs.com',
    });
    render(<Link>Test</Link>);
    expect(screen.getByRole('link').getAttribute('data-gatsby')).toBeFalsy();
  });

  it('exposes Gatsby navigate', () => {
    const Link = buildLink({ href: '#test' });
    Link.navigate();
    expect(gatsbyNav).toHaveBeenCalledTimes(1);
    expect(gatsbyNav).toHaveBeenCalledWith('#test');
  });

  it('exposes Gatsby navigate that allows to override query and fragments', () => {
    const Link = buildLink({ href: '/foo', query: { a: 'b' } });
    Link.navigate({ query: { a: 'c' }, fragment: 'bar' });
    expect(gatsbyNav).toHaveBeenCalledTimes(1);
    expect(gatsbyNav).toHaveBeenCalledWith('/foo?a=c#bar');
  });
});