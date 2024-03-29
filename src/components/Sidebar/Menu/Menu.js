// @flow strict
import React from 'react';
import { Link } from 'gatsby';
import styles from './Menu.module.scss';

type Props = {
  menu: {
    label: string,
    path?: string,
    externalPath?: string,
  }[]
};

const Menu = ({ menu }: Props) => (
  <nav className={styles['menu']}>
    <ul className={styles['menu__list']}>
      {menu.map((item) => (
        <li className={styles['menu__list-item']} key={item.path}>
          {item.path !== null && <Link
            to={item.path}
            className={styles['menu__list-item-link']}
            activeClassName={styles['menu__list-item-link--active']}
          >
            {item.label}
          </Link>}
          {item.externalPath !== null && <a
              href={item.externalPath}
              className={styles['menu__list-item-link']}
              rel="noopener noreferrer"
            >
              {item.label}
            </a>
          }
        </li>
      ))}
    </ul>
  </nav>
);

export default Menu;
