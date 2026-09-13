import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface ComponentChild {
    name: string;
    tag: string;
    content?: string;
    styles?: Record<string, string>;
}

interface ComponentDefinition {
    tag: string;
    styles?: Record<string, string>;
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
        'EasyUI',
        'component-map.json'
    );

    if (!fs.existsSync(mapPath)) {
        vscode.window.showErrorMessage(
            `EasyUI: component-map.json not found at ${mapPath}`
        );
        return;
    }

    const mapContent = fs.readFileSync(mapPath, 'utf-8');
    const componentMap: ComponentMap = JSON.parse(mapContent);

    const componentNames = Object.keys(componentMap);

    const componentName = await vscode.window.showQuickPick(
        componentNames,
        {
            placeHolder: 'Select a UI pattern'
        }
    );

    if (!componentName) {
        return;
    }

    const component = componentMap[componentName];

    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        vscode.window.showErrorMessage(
            'EasyUI: No active editor.'
        );
        return;
    }

    const document = editor.document;
    const position = editor.selection.active;

    const parentBlock = detectParentBlock(
        document.getText(),
        document.offsetAt(position)
    );

    const baseClass = parentBlock
        ? `${parentBlock}__${componentName}`
        : `__${componentName}`;

    const html = generateHtml(component, baseClass);
    const scss = generateScss(component, baseClass, parentBlock);

    await editor.edit(editBuilder => {
        editBuilder.insert(position, html);
    });

    await showScss(scss);

    vscode.window.showInformationMessage(
        `EasyUI: Generated ${baseClass}`
    );
}

function generateHtml(
    component: ComponentDefinition,
    baseClass: string
): string {
    const children = component.children ?? [];

    const childHtml = children
        .map(child => {
            const childClass = `${baseClass}--${child.name}`;
            const content = child.content ?? '';

            return `  <${child.tag} class="${childClass}">${content}</${child.tag}>`;
        })
        .join('\n');

    if (!childHtml) {
        return `<${component.tag} class="${baseClass}"></${component.tag}>\n`;
    }

    return `<${component.tag} class="${baseClass}">
${childHtml}
</${component.tag}>\n`;
}

function generateScss(
    component: ComponentDefinition,
    baseClass: string,
    parentBlock?: string
): string {
    const componentStyles = component.styles ?? {};
    const children = component.children ?? [];

    const componentStyleLines = Object.entries(componentStyles)
        .map(([property, value]) => `  ${property}: ${value};`)
        .join('\n');

    const childBlocks = children
        .map(child => {
            const styles = child.styles ?? {};

            const styleLines = Object.entries(styles)
                .map(([property, value]) => `    ${property}: ${value};`)
                .join('\n');

            return `
  &--${child.name} {
${styleLines}
  }`;
        })
        .join('');

    const componentName = baseClass.includes('__')
        ? baseClass.split('__')[1]
        : baseClass;

    const componentBlock = `&__${componentName} {
${componentStyleLines}${childBlocks}
}`;

    if (parentBlock) {
        return `.${parentBlock} {
  ${componentBlock.replace(/\n/g, '\n  ')}
}\n`;
    }

    return `${componentBlock}\n`;
}

function detectParentBlock(
    documentText: string,
    cursorOffset: number
): string | undefined {
    const beforeCursor = documentText.substring(0, cursorOffset);

    const classMatches = [
        ...beforeCursor.matchAll(
            /class=["']([^"']+)["']/g
        )
    ];

    if (!classMatches.length) {
        return undefined;
    }

    const lastClassMatch =
        classMatches[classMatches.length - 1];

    const classes = lastClassMatch[1]
        .split(/\s+/)
        .filter(Boolean);

    const bemBlock = classes.find(
        className =>
            !className.includes('__') &&
            !className.includes('--')
    );

    return bemBlock;
}

async function showScss(scss: string) {
    const document = await vscode.workspace.openTextDocument({
        content: scss,
        language: 'scss'
    });

    await vscode.window.showTextDocument(
        document,
        vscode.ViewColumn.Beside
    );
}

export function deactivate() { }