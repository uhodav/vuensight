import { parse, PropDescriptor } from 'vue-docgen-api';
import { JSDOM } from 'jsdom';
import { Dependent, Event, Prop, Slot, VueComponent } from  '@vuensight/types';

import { getComponentImportName } from '../utils/vue';
import { getTemplateContent } from '../utils/vue';
import { kebabize } from '../utils/kababize';

export const findDependencyInstancesInTemplate = (template: string, name: string): Element[] => {
  const templateWithoutTemplateTags = template.replace(/template/g, 'temp-tag');
  const fragment = JSDOM.fragment(templateWithoutTemplateTags);
  const dependencyUsagesCamelCase = Array.from(fragment.querySelectorAll(name));
  const dependencyUsagesKebabCase = Array.from(fragment.querySelectorAll(kebabize(name)));
  const result = [...dependencyUsagesCamelCase, ...dependencyUsagesKebabCase];
  if (result.length === 0 && template) {
    const tagRegex = new RegExp(`<(${name}|${kebabize(name)})[\s>]`, 'gi');
    const matches = template.matchAll(tagRegex);
    for (const _ of matches) {
      const element = fragment.ownerDocument.createElement('temp-tag');
      element.innerHTML = '';
      result.push(element);
    }
  }
  return result;
};

export const parseComponentFile = async (filePath: string): Promise<Partial<VueComponent> | null> => {
 try {
    const { displayName: name, props, events, slots } = await parse(filePath);
    return { name, props: props && formatProps(props), events, slots };
  } catch (e) {
    console.error(`Something went wrong while parsing the component: ${filePath}`, e);
  }
  return null;
};

const formatProps = (props: PropDescriptor[]):Prop[] => {
  return props.map((prop) => ({
    ...prop,
    default: prop?.defaultValue?.value,
  }));
};

export const isPropUsed = (template: Element, prop: Prop): boolean => {
  const camel = prop.name;
  const kebab = kebabize(prop.name);
  const propFormats = [
    camel,
    kebab,
    `:${camel}`,
    `:${kebab}`,
    `${camel}`,
    `${kebab}`,
    `:${camel}.sync`,
    `:${kebab}.sync`
  ];
  let isUsed = false;
  propFormats.forEach((format) => {
    if (!isUsed) isUsed = Boolean(template.attributes.getNamedItem(format));
  });
  // v-model (default and custom)
  if (!isUsed && (camel === 'model' || camel.startsWith('model'))) {
    isUsed = Boolean(template.attributes.getNamedItem('v-model')) || Boolean(template.attributes.getNamedItem(`v-model:${kebab}`));
  }
  // v-bind (object binding)
  if (!isUsed && template.attributes.getNamedItem('v-bind')) {
    isUsed = true;
  }
  // $attrs (proxying all attributes)
  if (!isUsed && template.attributes.getNamedItem('$attrs')) {
    isUsed = true;
  }
  return isUsed;
};

export const isEventUsed = (template: Element, event: Event): boolean => {
  const camel = event.name;
  const kebab = kebabize(event.name);
  const eventFormat = [
    `@${camel}`,
    `@${kebab}`,
    `v-on:${camel}`,
    `v-on:${kebab}`,
    `@update:${camel}`,
    `@update:${kebab}`,
    `v-on:update:${camel}`,
    `v-on:update:${kebab}`
  ];
  let isUsed = false;
  eventFormat.forEach((format) => (isUsed = isUsed || Boolean(template.attributes.getNamedItem(format))));
  // v-on (object binding)
  if (!isUsed && template.attributes.getNamedItem('v-on')) {
    isUsed = true;
  }
  // $listeners (proxying all listeners)
  if (!isUsed && template.attributes.getNamedItem('$listeners')) {
    isUsed = true;
  }
  // v-model (default and custom)
  if (!isUsed && (camel === 'update:model' || camel.startsWith('update:'))) {
    isUsed = Boolean(template.attributes.getNamedItem('v-model')) || Boolean(template.attributes.getNamedItem(`v-model:${kebab.replace('update:', '')}`));
  }
  if (!isUsed) {
    for (let i = 0; i < template.attributes.length; i++) {
      const attr = template.attributes[i];
      if (/^@update:(.+)/.test(attr.name)) {
        isUsed = true;
        break;
      }
    }
  }
  return isUsed;
};


export const isSlotUsed = (template: Element, slot: Slot): boolean => {
  const camel = slot.name;
  const kebab = kebabize(slot.name);
  const slotFormat = [
    `#${camel}`,
    `#${kebab}`,
    `v-slot:${camel}`,
    `v-slot:${kebab}`
  ];
  let isUsed = false;
  slotFormat.forEach((format) => {
    isUsed = isUsed || Boolean(template.innerHTML && template.innerHTML.includes(format));
  });
  // v-slot (object binding)
  if (!isUsed && template.attributes && template.attributes.getNamedItem('v-slot')) {
    isUsed = true;
  }
  if (!isUsed && template.innerHTML) {
    const combinedSlotRegex = new RegExp(
      `(<slot[^>]+name=["'](${camel}|${kebab})["'])|(<template\\s+(#|v-slot:)(${camel}|${kebab})(\\s*=\\s*["'][^"']*["'])?)`,
      'i'
    );
    isUsed = combinedSlotRegex.test(template.innerHTML);
  }
  return isUsed;
};

export const getUsedChannels = <Channel>(
    dependencyInstances: Element[],
    channels: Channel[],
    validator: (instance: Element, channel: Channel) => boolean
): number[] => {
  const usedChannels = new Set<number>();
  channels.forEach((channel, index) => {
    dependencyInstances.forEach((dependencyUsage) => validator(dependencyUsage, channel) && usedChannels.add(index));
  });
  return [...usedChannels];
};

export const getDependentWithUsedChannelsAnalysis = (
    { fullPath: dependentFullPath, name: dependentName, fileContent: dependentFilecontent }: VueComponent,
    { name, props, events, slots }: VueComponent
): Dependent => {
  const template = getTemplateContent(dependentFilecontent);
  if (!template) return {
    fullPath: dependentFullPath,
    name: dependentName,
    usedProps: [],
    usedEvents: [],
    usedSlots: []
  };
  let dependencyInstances = findDependencyInstancesInTemplate(template, name);
  if (dependencyInstances.length === 0)  {
    const importName = getComponentImportName(dependentFilecontent, name);
    dependencyInstances = importName ? findDependencyInstancesInTemplate(template, importName) : dependencyInstances;
  }
  return {
    fullPath: dependentFullPath,
    name: dependentName,
    usedProps: dependencyInstances ? getUsedChannels(dependencyInstances, props, isPropUsed) : [],
    usedEvents: dependencyInstances ? getUsedChannels(dependencyInstances, events, isEventUsed) : [],
    usedSlots: dependencyInstances ?  getUsedChannels(dependencyInstances, slots, isSlotUsed) : []
  };
};
