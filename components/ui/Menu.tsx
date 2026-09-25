'use client';

import { Fragment, type ReactNode } from 'react';
import { Menu as HeadlessMenu, Transition } from '@headlessui/react';
import { clsx } from 'clsx';

interface MenuProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
}

export function Menu({ trigger, children, align = 'right' }: MenuProps) {
  return (
    <HeadlessMenu as="div" className="relative inline-block text-left">
      <HeadlessMenu.Button as={Fragment}>{trigger}</HeadlessMenu.Button>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95"
      >
        <HeadlessMenu.Items
          className={clsx(
            'absolute z-20 mt-2 w-48 origin-top-right rounded-control border border-navaro-line bg-white py-1 focus:outline-none',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {children}
        </HeadlessMenu.Items>
      </Transition>
    </HeadlessMenu>
  );
}

export function MenuItem({
  children,
  onClick,
  danger,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <HeadlessMenu.Item disabled={disabled}>
      {({ active }) => (
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={clsx(
            'flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-light disabled:cursor-not-allowed disabled:opacity-40',
            danger ? 'text-danger' : 'text-navaro-green',
            active && !disabled && 'bg-navaro-hover'
          )}
        >
          {children}
        </button>
      )}
    </HeadlessMenu.Item>
  );
}
