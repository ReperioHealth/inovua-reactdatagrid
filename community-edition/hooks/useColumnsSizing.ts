/**
 * Copyright © INOVUA TRADING.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MutableRefObject } from 'react';
import {
  TypeComputedColumn,
  TypeComputedProps,
  TypeDataGridProps,
} from '../types';
import getScrollbarWidth from '../packages/getScrollbarWidth';

const removeItemFromArray = <T>(array: T[], obj: T) => {
  const index: number = array.indexOf(obj);

  if (index >= 0) {
    array.splice(index, 1);
  }
};

const getColumnsWidths = (columns: TypeComputedColumn[]) => {
  return columns.reduce((width: number, column: any) => {
    return width + column.computedWidth;
  }, 0);
};

const useColumnsSizing = (
  _props: TypeDataGridProps,
  _computedProps: TypeComputedProps,
  computedPropsRef: MutableRefObject<TypeComputedProps>
) => {
  const computeColumnSizesToFit = (gridWidth: number) => {
    const { current: computedProps } = computedPropsRef;
    if (!computedProps) {
      return;
    }

    const visibleColumns: TypeComputedColumn[] = computedProps.visibleColumns;

    if (gridWidth <= 0 || !visibleColumns.length) {
      return;
    }

    const columnsToSize: TypeComputedColumn[] = [];
    const columnsNotToSize: TypeComputedColumn[] = [];

    visibleColumns.forEach((column: TypeComputedColumn) => {
      if (column.resizable === false) {
        columnsNotToSize.push(column);
      } else {
        columnsToSize.push(column);
      }
    });

    const columnsToResize = columnsToSize.slice(0);
    let finished: boolean = false;

    const updateColumnsNotToSize = (column: TypeComputedColumn): void => {
      removeItemFromArray(columnsToResize, column);
      columnsNotToSize.push(column);
    };

    const newColumnSizes: { [key: string]: number } = {};

    while (!finished) {
      finished = true;
      const availableSpace: number =
        gridWidth - getColumnsWidths(columnsNotToSize);

      const scale: number = availableSpace / getColumnsWidths(columnsToResize);
      let spaceForLastColumn: number = availableSpace;

      for (let i = columnsToResize.length - 1; i >= 0; i--) {
        const column: TypeComputedColumn = columnsToResize[i];

        const minWidth: number | undefined = column.computedMinWidth;
        const maxWidth: number | undefined = column.computedMaxWidth;
        let newWidth: number = Math.round(column.computedWidth * scale);

        if (minWidth && newWidth < minWidth) {
          newWidth = minWidth;
          updateColumnsNotToSize(column);
          finished = false;
        } else if (maxWidth && newWidth > maxWidth) {
          newWidth = maxWidth;
          updateColumnsNotToSize(column);
          finished = false;
        } else if (i === 0) {
          newWidth = spaceForLastColumn;
        }

        const columnId: string = column.id;
        Object.assign(newColumnSizes, { [columnId]: newWidth });
        spaceForLastColumn -= newWidth;
      }
    }

    if (computedProps.virtualizeColumns) {
      const bodyRef = computedProps.bodyRef.current;
      const columnLayout = bodyRef.columnLayout;
      const headerLayout = columnLayout.headerLayout;
      const header = headerLayout.header;

      setTimeout(() => {
        header.updateColumns();
      }, 10);
    }

    let newReservedViewportWidth: number = computedProps.reservedViewportWidth;
    const columnFlexes = computedProps.columnFlexes;

    (computedProps as any).computeColumnSizes(
      newColumnSizes || {},
      columnFlexes || {},
      newReservedViewportWidth,
      {
        getColumnBy: computedProps.getColumnBy,
        onColumnResize: computedProps.initialProps.onColumnResize,
        onBatchColumnResize: computedProps.initialProps.onBatchColumnResize,
        columnSizes: computedProps.columnSizes,
        setColumnSizes: computedProps.setColumnSizes,
        setColumnFlexes: computedProps.setColumnFlexes,
      }
    );
  };

  const checkForAvaibleWidth = () => {
    const { current: computedProps } = computedPropsRef;
    if (!computedProps) {
      return;
    }

    const scrollbars = computedProps.scrollbars;
    const hasVerticalScrollbar = scrollbars.vertical;
    const scrollbarWidth = hasVerticalScrollbar ? getScrollbarWidth() : 0;
    const computedAvailableWidth = computedProps.availableWidth || 0;

    const availableWidth = computedAvailableWidth - scrollbarWidth;

    if (availableWidth > 0) {
      computeColumnSizesToFit(availableWidth);
    }
  };

  const computeColumnSizesAuto = (
    columns: TypeComputedColumn[],
    callback: (column: TypeComputedColumn) => boolean
  ) => {
    const { current: computedProps } = computedPropsRef;
    if (!computedProps) {
      return;
    }

    if (!columns.length) {
      return;
    }

    columns.forEach((column: TypeComputedColumn) => {
      callback(column);
    });
  };

  const getCellForColumn = (column: TypeComputedColumn | any, row: any) => {
    const { current: computedProps } = computedPropsRef;
    if (!computedProps) {
      return;
    }

    let result;

    const idProperty = computedProps.idProperty;
    const columnId = column[idProperty];

    const cells = row.getCells();
    if (!cells.length) {
      return;
    }

    cells.forEach((cell: any) => {
      const cellProps = cell.props;
      const cellId = cellProps[idProperty];

      if (columnId === cellId) {
        result = cell.domRef.current;
      }
    });

    return result;
  };

  const getCellsForColumn = (column: TypeComputedColumn) => {
    const { current: computedProps } = computedPropsRef;
    if (!computedProps) {
      return;
    }

    const result: any[] = [];

    if (computedProps.getRows) {
      (computedProps.getRows() as any).forEach((rowInstance: any) => {
        const row = rowInstance.row;
        const cell = getCellForColumn(column, row);
        result.push(cell);
      });
    }

    return result;
  };

  const cloneIntoDummyContainer = (cell: any, dummyContainer: any) => {
    const cloneCell = cell.cloneNode(true);

    cloneCell.style.width = '';
    cloneCell.style.position = 'static';
    cloneCell.style.left = '';
    cloneCell.firstChild.style.width = 'fit-content';

    const cloneParent = document.createElement('div');

    cloneParent.appendChild(cloneCell);
    dummyContainer.appendChild(cloneParent);
  };

  const computeOptimizedWidth = (column: TypeComputedColumn | any): number => {
    const { current: computedProps } = computedPropsRef;
    if (!computedProps) {
      return -1;
    }

    const cells = getCellsForColumn(column);

    if (!cells || !cells.length) {
      return -1;
    }

    const dummyContainer = document.createElement('span');
    dummyContainer.style.position = 'fixed';

    const vl = computedProps.getVirtualList();
    const container = vl.getContainerNode();
    container.appendChild(dummyContainer);

    let snapshotWidth: number = 0;

    cells!.forEach(cell => {
      snapshotWidth = cell.offsetWidth;
      cloneIntoDummyContainer(cell, dummyContainer);
    });

    let dummyContainerWidth = dummyContainer.offsetWidth;
    if (snapshotWidth < dummyContainerWidth) {
      // the border width which is 1px it is added
      dummyContainerWidth += 1;
    }

    container.removeChild(dummyContainer);

    return dummyContainerWidth;
  };

  const normaliseWidth = (
    column: TypeComputedColumn,
    width: number
  ): number => {
    const minWidth = column.minWidth;
    const maxWidth = column.maxWidth;

    if (minWidth && width < minWidth) {
      width = minWidth;
    }
    if (maxWidth && width > maxWidth) {
      width = maxWidth;
    }

    return width;
  };

  const setColumnSizesToFit = () => {
    const { current: computedProps } = computedPropsRef;
    if (!computedProps) {
      return;
    }

    checkForAvaibleWidth();
  };

  const setColumnSizesAuto = () => {
    const { current: computedProps } = computedPropsRef;
    if (!computedProps) {
      return;
    }

    const columns = computedProps.visibleColumns;
    let columnsToSize: TypeComputedColumn[] = [];
    let counter: number = -1;

    const newColumnSizes: { [key: string]: number } = {};

    while (counter !== 0) {
      counter = 0;
      computeColumnSizesAuto(columns, (column: TypeComputedColumn): boolean => {
        if (columnsToSize.indexOf(column) >= 0) {
          return false;
        }

        const optimizedWidth = computeOptimizedWidth(column);

        if (optimizedWidth > 0) {
          const newWidth = normaliseWidth(column, optimizedWidth);
          const columnId: string = column.id;
          columnsToSize.push(column);
          Object.assign(newColumnSizes, { [columnId]: newWidth });
          counter++;
        }

        return true;
      });
    }

    if (computedProps.virtualizeColumns) {
      const bodyRef = computedProps.bodyRef.current;
      const columnLayout = bodyRef.columnLayout;
      const headerLayout = columnLayout.headerLayout;
      const header = headerLayout.header;

      setTimeout(() => {
        header.updateColumns();
      }, 10);
    }

    let newReservedViewportWidth: number = computedProps.reservedViewportWidth;
    const columnFlexes = computedProps.columnFlexes;

    (computedProps as any).computeColumnSizes(
      newColumnSizes || {},
      columnFlexes || {},
      newReservedViewportWidth,
      {
        getColumnBy: computedProps.getColumnBy,
        onColumnResize: computedProps.initialProps.onColumnResize,
        onBatchColumnResize: computedProps.initialProps.onBatchColumnResize,
        columnSizes: computedProps.columnSizes,
        setColumnSizes: computedProps.setColumnSizes,
        setColumnFlexes: computedProps.setColumnFlexes,
      }
    );
  };

  return {
    setColumnSizesToFit,
    setColumnSizesAuto,
  };
};

export default useColumnsSizing;
