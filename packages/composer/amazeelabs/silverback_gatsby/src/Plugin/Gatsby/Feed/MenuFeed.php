<?php

namespace Drupal\silverback_gatsby\Plugin\Gatsby\Feed;

use Drupal\content_translation\ContentTranslationManagerInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Entity\TranslatableInterface;
use Drupal\Core\Language\LanguageInterface;
use Drupal\Core\Language\LanguageManagerInterface;
use Drupal\Core\Menu\MenuLinkTreeElement;
use Drupal\Core\Menu\MenuLinkTreeInterface;
use Drupal\Core\Menu\MenuTreeParameters;
use Drupal\Core\Plugin\ContainerFactoryPluginInterface;
use Drupal\Core\Session\AccountInterface;
use Drupal\graphql\GraphQL\Execution\FieldContext;
use Drupal\graphql\GraphQL\Execution\ResolveContext;
use Drupal\graphql\GraphQL\Resolver\ResolverInterface;
use Drupal\graphql\GraphQL\ResolverBuilder;
use Drupal\graphql\GraphQL\ResolverRegistryInterface;
use Drupal\graphql_directives\Plugin\GraphQL\DataProducer\FilterMenuItems;
use Drupal\silverback_gatsby\Annotation\GatsbyFeed;
use Drupal\silverback_gatsby\Plugin\FeedBase;
use Drupal\silverback_gatsby\Plugin\GraphQL\DataProducer\GatsbyBuildId;
use Drupal\system\Entity\Menu;
use GraphQL\Deferred;
use GraphQL\Language\AST\DocumentNode;
use GraphQL\Type\Definition\ResolveInfo;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Feed plugin that creates Gatsby feeds based on Drupal menus.
 *
 * @GatsbyFeed(
 *   id = "menu"
 * )
 */
class MenuFeed extends FeedBase implements ContainerFactoryPluginInterface {

  /**
   * The target menu id.
   *
   * @var string | null
   */
  protected $menu_id;

  /**
   * Internal menu id's. The first one the current user has access to will be
   * picked.
   *
   * @var string[] | null
   */
  protected $menu_ids;

  /**
   * The maximum menu level.
   *
   * @var int
   */
  protected int $max_level;

  /**
   * The GraphQL item type used for menu items.
   *
   * @var string | null
   */
  protected $item_type;

  /**
   * @var \Drupal\content_translation\ContentTranslationManagerInterface|null
   */
  protected ?ContentTranslationManagerInterface $contentTranslationManager;

  /**
   * @var \Drupal\Core\Language\LanguageManagerInterface
   */
  protected LanguageManagerInterface $languageManager;

  /**
   * @var \Drupal\Core\Menu\MenuLinkTreeInterface
   */
  protected MenuLinkTreeInterface $menuLinkTree;

  /**
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected EntityTypeManagerInterface $entityTypeManager;

  /**
   * {@inheritDoc}
   */
  public static function create(
    ContainerInterface $container,
    array $configuration,
    $plugin_id,
    $plugin_definition
  ) {
    return new static(
      $configuration,
      $plugin_id,
      $plugin_definition,
      $container->has('content_translation.manager')
        ? $container->get('content_translation.manager')
        : NULL,
      $container->get('menu.link_tree'),
      $container->get('language_manager'),
      $container->get('entity_type.manager')
    );
  }

  public function __construct(
    $config,
    $plugin_id,
    $plugin_definition,
    ?ContentTranslationManagerInterface $contentTranslationManager,
    MenuLinkTreeInterface $menuLinkTree,
    LanguageManagerInterface $languageManager,
    EntityTypeManagerInterface $entityTypeManager
  ) {
    $this->menu_id = $config['menu_id'] ?? NULL;
    $this->menu_ids = $config['menu_ids'] ?? NULL;
    $this->max_level = $config['max_level'] ?? -1;
    $this->item_type = $config['item_type'] ?? NULL;
    $this->contentTranslationManager = $contentTranslationManager;
    $this->menuLinkTree = $menuLinkTree;
    $this->languageManager = $languageManager;
    $this->entityTypeManager = $entityTypeManager;

    parent::__construct(
      $config,
      $plugin_id,
      $plugin_definition
    );
  }

  /**
   * Expose the configured max level so it can be used by the schema extension.
   *
   * @return int|mixed
   */
  public function getMaxLevel() {
    return $this->max_level;
  }

  /**
   * The menu ids to be loaded and negotiated.
   *
   * @return string[]
   */
  public function menuIds() {
    $ids = $this->menu_ids ?: [];
    if ($this->menu_id) {
      $ids[] = $this->menu_id;
    }
    return $ids;
  }

  /**
   * {@inheritDoc}
   */
  public function isTranslatable(): bool {
    return $this->contentTranslationManager &&
      $this->contentTranslationManager->isEnabled('menu_link_content', 'menu_link_content');
  }

  /**
   * {@inheritDoc}
   */
  public function getUpdateIds($context, ?AccountInterface $account) : array {
    $params = new MenuTreeParameters();
    if ($this->max_level > 0) {
      $params->maxDepth = $this->max_level;
    }

    // Get all menus that are associated with this feed, and pick the first one
    // the account has access to.
    /** @var \Drupal\system\Entity\Menu[] $menus */
    $menus = $this->entityTypeManager->getStorage('menu')->loadMultiple($this->menuIds());
    $relevantMenu = NULL;
    foreach($menus as $menu) {
      if (!$account || $menu->access('view label', $account)) {
        $relevantMenu = $menu;
        break;
      }
    }

    if (!$relevantMenu) {
      return [];
    }

    $tree = $this->menuLinkTree->load($relevantMenu->id(), $params);
    $items = FilterMenuItems::flatten($tree, -1);

    $ids = [$context];
    $match = count(array_filter($items, function (MenuLinkTreeElement $item) use ($ids) {
      return in_array($item->link->getPluginId(), $ids);
    })) > 0;

    // If the menu item is not in any exposed menus, don't return any updates.
    if (!$match) {
      return [];
    }

    if ($this->isTranslatable()) {
      // If menu items are translatable, trigger an update in each language,
      // since we can't determine easily which language was affected.
      return array_map(
        fn (LanguageInterface $lang) =>
          GatsbyBuildId::build($relevantMenu->id(), $lang->getId())
        , $this->languageManager->getLanguages());
    }
    // Else, simply return the menu id.
    return [$relevantMenu->id()];
  }

  /**
   * {@inheritDoc}
   */
  public function resolveItem(ResolverInterface $id, ?ResolverInterface $langcode = null): ResolverInterface {
    $resolver = $this->builder->produce('entity_load')
      ->map('type', $this->builder->fromValue('menu'))
      ->map('id', $id)
      ->map('access', $this->builder->fromValue(true))
      ->map('access_operation', $this->builder->fromValue('view label'));
    if ($this->isTranslatable() && $langcode) {
      $resolver->map('language', $langcode);
      $resolver = $this->builder->compose(
        $this->builder->context('current_menu_language', $langcode),
        $resolver,
        $this->builder->callback(function ($value, $args, ResolveContext $context, ResolveInfo $info, FieldContext $fieldContext) {
        $value->__language = $fieldContext->getContextValue('current_menu_language');
        return $value;
      }));
    }
    return $resolver;
  }

  /**
   * {@inheritDoc}
   */
  public function resolveItems(ResolverInterface $limit, ResolverInterface $offset): ResolverInterface {
    return $this->builder->produce('entity_load_multiple')
      ->map('type', $this->builder->fromValue('menu'))
      ->map('ids', $this->builder->fromValue($this->menuIds()))
      ->map('access', $this->builder->fromValue(true))
      ->map('access_operation', $this->builder->fromValue('view label'));
  }

  /**
   * {@inheritDoc}
   */
  public function resolveId(): ResolverInterface {
    return $this->builder->produce('entity_id')
      ->map('entity', $this->builder->fromParent());
  }

  /**
   * {@inheritDoc}
   */
  public function resolveLangcode(): ResolverInterface {
    return $this->builder->callback(
      fn(Menu $value) => $value->language()->getId()
    );
  }

  /**
   * {@inheritDoc}
   */
  public function resolveDefaultTranslation(): ResolverInterface {
    return $this->builder->callback(
      fn(Menu $value) => $value->language()->isDefault()
    );
  }

  /**
   * {@inheritDoc}
   */
  public function resolveTranslations(): ResolverInterface {
    return $this->builder->compose($this->builder->callback(function (Menu $menu) {
      return array_map(function (LanguageInterface $lang) use ($menu) {
        $clone = clone $menu;
        $clone->set('langcode', $lang->getId());
        return $clone;
      }, $this->languageManager->getLanguages());
    }));
  }
}
