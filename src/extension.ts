import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface ComponentChild {
    name: string;
    tag: string;
    content?: string;
    styles?: Record<string, string>;
    responsive?: Record<string, Record<string, string>>;
    states?: Record<string, Record<string, string>>;
}

interface ComponentDefinition {
    tag: string;
    styles?: Record<string, string>;
    responsive?: Record<string, Record<string, string>>;
    states?: Record<string, Record<string, string>>;
    children?: ComponentChild[];
}

interface ComponentMap {
    [key: string]: ComponentDefinition;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('EasyUI activated');

    const disposable = vscode.commands.registerCommand(
        'easy-ui.generate',
        async () => {
            await generateComponent();
        }
    );

    context.subscriptions.push(disposable);
}

async function generateComponent() {
    const workspace = vscode.workspace.workspaceFolders?.[0];

    if (!workspace) {
        vscode.window.showErrorMessage(
            'EasyUI: No workspace is open.'
        );
        return;
    }

    const mapPath = path.join(
        workspace.uri.fsPath,
        'easy-ui',
        'component-map.json'
    );

    if (!fs.existsSync(mapPath)) {
        vscode.window.showErrorMessage(
            `EasyUI: component-map.json not found at ${mapPath}`
        );
        return;
    }

    try {
        const mapContent = fs.readFileSync(
            mapPath,
            'utf-8'
        );

        const componentMap: ComponentMap =
            JSON.parse(mapContent);

        const componentNames =
            Object.keys(componentMap);

        if (!componentNames.length) {
            vscode.window.showErrorMessage(
                'EasyUI: No UI patterns found.'
            );
            return;
        }

        const componentName =
            await vscode.window.showQuickPick(
                componentNames,
                {
                    placeHolder: 'Select a UI pattern'
                }
            );

        if (!componentName) {
            return;
        }

        const component =
            componentMap[componentName];

        const editor =
            vscode.window.activeTextEditor;

        if (!editor) {
            vscode.window.showErrorMessage(
                'EasyUI: No active editor.'
            );
            return;
        }

        const document = editor.document;
        const cursorOffset =
            document.offsetAt(
                editor.selection.active
            );

        const parentBlock =
            detectParentBlock(
                document.getText(),
                cursorOffset
            );

        const baseClass = parentBlock
            ? `${parentBlock}__${componentName}`
            : `__${componentName}`;

        const html =
            generateHtml(
                component,
                baseClass
            );

        const scss =
            generateScss(
                component,
                baseClass,
                parentBlock
            );

        await editor.edit(
            editBuilder => {
                editBuilder.insert(
                    editor.selection.active,
                    html
                );
            }
        );

        await showScss(scss);

        vscode.window.showInformationMessage(
            `EasyUI: Generated ${baseClass}`
        );

    } catch (error) {
        vscode.window.showErrorMessage(
            `EasyUI: Failed to generate component. ${
                error instanceof Error
                    ? error.message
                    : String(error)
            }`
        );
    }
}


/* -------------------------------------------------------------------------- */
/* HTML GENERATION                                                            */
/* -------------------------------------------------------------------------- */

function generateHtml(
    component: ComponentDefinition,
    baseClass: string
): string {
    const children =
        component.children ?? [];

    if (!children.length) {
        return `<${component.tag} class="${baseClass}"></${component.tag}>\n`;
    }

    const childHtml =
        children
            .map(child => {
                const childClass =
                    `${baseClass}--${child.name}`;

                const content =
                    child.content ?? '';

                return `  <${child.tag} class="${childClass}">${content}</${child.tag}>`;
            })
            .join('\n');

    return `<${component.tag} class="${baseClass}">
${childHtml}
</${component.tag}>\n`;
}


/* -------------------------------------------------------------------------- */
/* SCSS GENERATION                                                            */
/* -------------------------------------------------------------------------- */

function generateScss(
    component: ComponentDefinition,
    baseClass: string,
    parentBlock?: string
): string {
    const styles =
        component.styles ?? {};

    const states =
        component.states ?? {};

    const responsive =
        component.responsive ?? {};

    const children =
        component.children ?? [];

    const componentName =
        getComponentName(baseClass);

    let scss = '';

    /*
     * Component
     */
    scss += `&__${componentName} {\n`;

    /*
     * Base styles
     */
    scss += generateStyleLines(
        styles,
        2
    );

    /*
     * Responsive
     *
     * Example:
     * @include media-down(md) {}
     */
    scss += generateResponsiveBlocks(
        responsive,
        2
    );

    /*
     * States
     *
     * Example:
     * &:hover {}
     * &:focus {}
     * &:active {}
     */
    scss += generateStateBlocks(
        states,
        2
    );

    /*
     * Children
     */
    for (const child of children) {
        scss += generateChildScss(
            child
        );
    }

    scss += `}\n`;

    /*
     * If component is generated
     * inside a parent block:
     *
     * .card {
     *   &__button {}
     * }
     */
    if (parentBlock) {
        return `.${parentBlock} {
${indentBlock(scss, 1)}
}
`;
    }

    /*
     * Standalone component:
     *
     * &__button {}
     */
    return scss;
}


/* -------------------------------------------------------------------------- */
/* CHILD SCSS                                                                 */
/* -------------------------------------------------------------------------- */

function generateChildScss(
    child: ComponentChild
): string {
    const styles =
        child.styles ?? {};

    const states =
        child.states ?? {};

    const responsive =
        child.responsive ?? {};

    let scss =
        `\n  &--${child.name} {\n`;

    /*
     * Base child styles
     */
    scss += generateStyleLines(
        styles,
        4
    );

    /*
     * Child responsive styles
     */
    scss += generateResponsiveBlocks(
        responsive,
        4
    );

    /*
     * Child states
     */
    scss += generateStateBlocks(
        states,
        4
    );

    scss += `  }`;

    return scss;
}


/* -------------------------------------------------------------------------- */
/* STATE GENERATION                                                           */
/* -------------------------------------------------------------------------- */

function generateStateBlocks(
    states: Record<
        string,
        Record<string, string>
    >,
    indentLevel: number
): string {
    let result = '';

    for (const [state, styles] of Object.entries(states)) {
        const styleLines =
            generateStyleLines(
                styles,
                indentLevel + 2
            );

        result += `\n${' '.repeat(indentLevel)}&:${state} {\n`;
        result += styleLines;
        result += `${' '.repeat(indentLevel)}}`;
    }

    return result;
}


/* -------------------------------------------------------------------------- */
/* RESPONSIVE GENERATION                                                      */
/* -------------------------------------------------------------------------- */

function generateResponsiveBlocks(
    responsive: Record<
        string,
        Record<string, string>
    >,
    indentLevel: number
): string {
    let result = '';

    for (const [mixin, styles] of Object.entries(responsive)) {
        const styleLines =
            generateStyleLines(
                styles,
                indentLevel + 2
            );

        result += `\n${' '.repeat(indentLevel)}@include ${mixin} {\n`;
        result += styleLines;
        result += `${' '.repeat(indentLevel)}}`;
    }

    return result;
}


/* -------------------------------------------------------------------------- */
/* STYLE GENERATION                                                           */
/* -------------------------------------------------------------------------- */

function generateStyleLines(
    styles: Record<string, string>,
    indentLevel: number
): string {
    const entries =
        Object.entries(styles);

    if (!entries.length) {
        return '';
    }

    const indentation =
        ' '.repeat(indentLevel);

    return entries
        .map(
            ([property, value]) =>
                `${indentation}${property}: ${value};`
        )
        .join('\n') + '\n';
}


/* -------------------------------------------------------------------------- */
/* BEM HELPERS                                                                */
/* -------------------------------------------------------------------------- */

function getComponentName(
    baseClass: string
): string {
    const separatorIndex =
        baseClass.indexOf('__');

    if (separatorIndex === -1) {
        return baseClass.replace(
            /^__/,
            ''
        );
    }

    return baseClass.substring(
        separatorIndex + 2
    );
}


/* -------------------------------------------------------------------------- */
/* PARENT BLOCK DETECTION                                                     */
/* -------------------------------------------------------------------------- */

function detectParentBlock(
    documentText: string,
    cursorOffset: number
): string | undefined {
    const beforeCursor =
        documentText.substring(
            0,
            cursorOffset
        );

    const classMatches = [
        ...beforeCursor.matchAll(
            /class=["']([^"']+)["']/g
        )
    ];

    if (!classMatches.length) {
        return undefined;
    }

    const lastClassMatch =
        classMatches[
            classMatches.length - 1
        ];

    const classes =
        lastClassMatch[1]
            .split(/\s+/)
            .filter(Boolean);

    /*
     * Find a normal BEM block.
     *
     * Example:
     *
     * card
     * card__header
     * card--active
     *
     * We want:
     *
     * card
     */
    const bemBlock =
        classes.find(
            className =>
                !className.includes('__') &&
                !className.includes('--')
        );

    return bemBlock;
}


/* -------------------------------------------------------------------------- */
/* INDENTATION                                                                */
/* -------------------------------------------------------------------------- */

function indentBlock(
    block: string,
    level: number
): string {
    const indentation =
        '  '.repeat(level);

    return block
        .split('\n')
        .map(line =>
            line.length
                ? indentation + line
                : line
        )
        .join('\n');
}


/* -------------------------------------------------------------------------- */
/* SHOW SCSS                                                                  */
/* -------------------------------------------------------------------------- */

async function showScss(
    scss: string
) {
    const document =
        await vscode.workspace.openTextDocument({
            content: scss,
            language: 'scss'
        });

    await vscode.window.showTextDocument(
        document,
        vscode.ViewColumn.Beside
    );
}


/* -------------------------------------------------------------------------- */
/* DEACTIVATE                                                                 */
/* -------------------------------------------------------------------------- */

export function deactivate() {}