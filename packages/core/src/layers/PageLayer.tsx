/**
 * A React component to view a PDF document
 *
 * @see https://react-pdf-viewer.dev
 * @license https://react-pdf-viewer.dev/license
 * @copyright 2019-2021 Nguyen Huu Phuoc <me@phuoc.ng>
 */

import * as React from 'react';

import AnnotationLayer from '../annotations/AnnotationLayer';
import Spinner from '../components/Spinner';
import useIntersectionObserver, { VisibilityChanged } from '../hooks/useIntersectionObserver';
import RenderPageProps, { RenderPage } from '../layouts/RenderPage';
import SpecialZoomLevel from '../SpecialZoomLevel';
import ThemeContext from '../theme/ThemeContext';
import { Plugin } from '../types/Plugin';
import PdfJs from '../vendors/PdfJs';
import CanvasLayer from './CanvasLayer';
import SvgLayer from './SvgLayer';
import TextLayer from './TextLayer';

interface PageLayerProps {
    currentPage: number;
    doc: PdfJs.PdfDocument;
    height: number;
    pageIndex: number;
    plugins: Plugin[];
    renderPage?: RenderPage;
    rotation: number;
    scale: number;
    width: number;
    onExecuteNamedAction(action: string): void;
    onJumpToDest(pageIndex: number, bottomOffset: number, leftOffset: number, scaleTo: number | SpecialZoomLevel): void;
    onPageVisibilityChanged(pageIndex: number, ratio: number): void;
}

interface PageSizeState {
    page?: PdfJs.Page | null;
    pageHeight: number;
    pageWidth: number;
    viewportRotation: number;
}

const NUMBER_OF_OVERSCAN_PAGES = 2;

const PageLayer: React.FC<PageLayerProps> = ({
    currentPage, doc, height, pageIndex, plugins, renderPage, rotation, scale, width,
    onExecuteNamedAction, onJumpToDest, onPageVisibilityChanged,
}) => {
    const theme = React.useContext(ThemeContext);
    const [pageSize, setPageSize] = React.useState<PageSizeState>({
        page: null,
        pageHeight: height,
        pageWidth: width,
        viewportRotation: 0,
    });

    const { page, pageHeight, pageWidth } = pageSize;

    const prevIsCalculated = React.useRef(false);

    const intersectionThreshold = Array(10).fill(null).map((_, i) => i / 10);

    const scaledWidth = pageWidth * scale;
    const scaledHeight = pageHeight * scale;

    const isVertical = Math.abs(rotation) % 180 === 0;
    const w = isVertical ? scaledWidth : scaledHeight;
    const h = isVertical ? scaledHeight : scaledWidth;

    const determinePageSize = () => {
        if (prevIsCalculated.current) {
            return;
        }
        prevIsCalculated.current = true;

        doc.getPage(pageIndex + 1).then((pdfPage) => {
            const viewport = pdfPage.getViewport({ scale: 1 });

            setPageSize({
                page: pdfPage,
                pageHeight: viewport.height,
                pageWidth: viewport.width,
                viewportRotation: viewport.rotation,
            });
        });
    };

    const visibilityChanged = (params: VisibilityChanged): void => {
        onPageVisibilityChanged(pageIndex, params.isVisible ? params.ratio : -1);
        if (params.isVisible) {
            determinePageSize();
        }
    };

    // Default page renderer
    const defaultPageRenderer: RenderPage = (props: RenderPageProps) => (
        <>
            {props.canvasLayer.children}
            {props.textLayer.children}
            {props.annotationLayer.children}
        </>
    );
    const renderPageLayer = renderPage || defaultPageRenderer;

    // To support the document which is already rotated
    const rotationNumber = (rotation + pageSize.viewportRotation) % 360;

    const containerRef = useIntersectionObserver({
        threshold: intersectionThreshold,
        onVisibilityChanged: visibilityChanged,
    });

    React.useEffect(() => {
        if (currentPage - NUMBER_OF_OVERSCAN_PAGES <= pageIndex && pageIndex <= currentPage + NUMBER_OF_OVERSCAN_PAGES) {
            determinePageSize();
        }
    }, [currentPage]);

    return (
        <div
            ref={containerRef}
            className={`${theme.prefixClass}-page-layer`}
            style={{
                height: `${h}px`,
                width: `${w}px`,
            }}
        >
            {
                !page
                    ? <Spinner />
                    : <>
                    {
                        renderPageLayer({
                            annotationLayer: {
                                attrs: {},
                                children: (
                                    <AnnotationLayer
                                        doc={doc}
                                        page={page}
                                        pageIndex={pageIndex}
                                        plugins={plugins}
                                        rotation={rotationNumber}
                                        scale={scale}
                                        onExecuteNamedAction={onExecuteNamedAction}
                                        onJumpToDest={onJumpToDest}
                                    />
                                )
                            },
                            canvasLayer: {
                                attrs: {},
                                children: (
                                    <CanvasLayer
                                        height={h}
                                        page={page}
                                        pageIndex={pageIndex}
                                        plugins={plugins}
                                        rotation={rotationNumber}
                                        scale={scale}
                                        width={w}
                                    />
                                ),
                            },
                            doc,
                            height: h,
                            pageIndex,
                            rotation,
                            scale,
                            svgLayer: {
                                attrs: {},
                                children: (
                                    <SvgLayer height={h} page={page} rotation={rotationNumber} scale={scale} width={w} />
                                ),
                            },
                            textLayer: {
                                attrs: {},
                                children: (
                                    <TextLayer
                                        page={page}
                                        pageIndex={pageIndex}
                                        plugins={plugins}
                                        rotation={rotationNumber}
                                        scale={scale}
                                    />
                                )
                            },
                            width: w,
                        })
                    }
                    {
                        plugins.map((plugin, idx) => 
                            plugin.renderPageLayer
                            ? 
                                <React.Fragment key={idx}>
                                {
                                    plugin.renderPageLayer({
                                        doc,
                                        height: h,
                                        pageIndex,
                                        rotation,
                                        scale,
                                        width: w,
                                    })
                                }
                                </React.Fragment>
                            : <React.Fragment key={idx}></React.Fragment>
                        )
                    }
                    </>
            }
        </div>
    );
};

export default PageLayer;
