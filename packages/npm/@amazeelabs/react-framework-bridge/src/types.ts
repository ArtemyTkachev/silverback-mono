import {
  FormikConfig,
  FormikFormProps,
  FormikProps,
  FormikValues,
} from 'formik';
import { Element } from 'html-react-parser';
import { stringify } from 'qs';
import React from 'react';

export type ClassFunction = (domNode: Element) => string | null;

export type Html = React.VFC<{
  classNames?: {
    [key: string]: string | ClassFunction;
  };
}>;

export type HtmlBuilder = (input: string) => Html;

export type Image = React.VFC<{
  className?: string;
}>;

export type ImageProps = Omit<
  React.DetailedHTMLProps<
    React.ImgHTMLAttributes<HTMLImageElement>,
    HTMLImageElement
  >,
  'className'
> & { alt: string };

export type ImageBuilder = (props: ImageProps) => Image;

export type Link<Query extends Parameters<typeof stringify>[1] = {}> =
  React.FC<{
    className?: string;
    activeClassName?: string;
    query?: Query;
    fragment?: string;
  }> & {
    navigate: (opts?: { query?: Query; fragment?: string }) => void;
  };

export type LinkProps<Query extends Parameters<typeof stringify>[1] = {}> =
  Omit<
    React.DetailedHTMLProps<
      React.AnchorHTMLAttributes<HTMLAnchorElement>,
      HTMLAnchorElement
    >,
    'className'
  > & {
    segments?: Array<string | null | undefined>;
    query?: Query;
    queryOptions?: Query;
  };

export type LinkBuilder<T> = (props: LinkProps<T>) => Link;

export type Form<Values extends FormikValues> = React.FC<
  Omit<FormikFormProps, 'target' | 'action'> &
    Pick<FormikConfig<Values>, 'children'>
>;

export type FormBuilderProps<Values extends FormikValues> = Omit<
  FormikConfig<Values>,
  'onSubmit'
> &
  Partial<Pick<FormikConfig<Values>, 'onSubmit'>>;
