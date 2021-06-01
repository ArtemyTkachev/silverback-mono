<?php

namespace Drupal\silverback_gatsby\Plugin\GraphQL\SchemaExtension;

use Drupal\Component\Plugin\PluginManagerInterface;
use Drupal\Core\Extension\ModuleHandlerInterface;
use Drupal\graphql\GraphQL\Execution\ResolveContext;
use Drupal\graphql\GraphQL\Resolver\ResolverInterface;
use Drupal\graphql\GraphQL\ResolverBuilder;
use Drupal\graphql\GraphQL\ResolverRegistry;
use Drupal\graphql\GraphQL\ResolverRegistryInterface;
use Drupal\graphql\Plugin\GraphQL\SchemaExtension\SdlSchemaExtensionPluginBase;
use Drupal\silverback_gatsby\GraphQL\DirectiveProviderExtensionInterface;
use Drupal\silverback_gatsby\GraphQL\ParentAwareSchemaExtensionInterface;
use Drupal\silverback_gatsby\Plugin\FeedInterface;
use GraphQL\Language\AST\ObjectTypeDefinitionNode;
use GraphQL\Language\Parser;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Schema extension plugin that prepares any schema to be consumed by Gatsby.
 *
 * @SchemaExtension(
 *   id = "silverback_gatsby",
 *   name = "Silverback Gatsby",
 *   description = "Schema extension providing default resolvers for Gatsby."
 * )
 */
class SilverbackGatsbySchemaExtension extends SdlSchemaExtensionPluginBase
  implements ParentAwareSchemaExtensionInterface, DirectiveProviderExtensionInterface {

  /**
   * The parent schema definition this extension is attached to.
   *
   * @var string
   */
  protected string $parentSchema;

  /**
   * The list of feeds that are used by the parent schema.
   *
   * @var array
   */
  protected array $feeds = [];

  /**
   * @var \Drupal\Core\Plugin\DefaultPluginManager|object|null
   */
  protected $feedManager;


  /**
   * {@inheritdoc}
   *
   * @codeCoverageIgnore
   */
  public static function create(ContainerInterface $container, array $configuration, $plugin_id, $plugin_definition) {
    return new static(
      $configuration,
      $plugin_id,
      $plugin_definition,
      $container->get('module_handler'),
      $container->get('silverback_gatsby.feed_manager')
    );
  }

  /**
   * {@inheritDoc}
   */
  public function __construct(
    array $configuration,
    $pluginId,
    array $pluginDefinition,
    ModuleHandlerInterface $moduleHandler,
    PluginManagerInterface $feedManager
  ) {
    parent::__construct(
      $configuration,
      $pluginId,
      $pluginDefinition,
      $moduleHandler,
    );
    $this->feedManager = $feedManager;
  }

  /**
   * {@inheritDoc}
   */
  public function setParentSchemaDefinition(string $definition) {
    $this->parentSchema = $definition;
  }

  /**
   * {@inheritDoc}
   */
  public function getDirectiveDefinitions(): string {
    $feeds = $this->feedManager->getDefinitions();
    return implode("\n", array_map(fn ($def) => $def['directive'], $feeds));
  }

  /**
   * Retrieve all feeds that are referenced in the host schema.
   *
   * @return \Drupal\silverback_gatsby\Plugin\FeedInterface[]
   * @throws \Drupal\Component\Plugin\Exception\PluginException
   * @throws \GraphQL\Error\SyntaxError
   */
  public function getFeeds(): array {
    if (count($this->feeds) === 0) {
      $ast = Parser::parse($this->parentSchema);
      // Search for object type definitions ...
      foreach ($ast->definitions->getIterator() as $definition) {
        // ... that have directives.
        if ($definition instanceof ObjectTypeDefinitionNode && $definition->directives) {
          // Create feed instances for all directives that are know to the
          // feed manager.
          foreach ($definition->directives->getIterator() as $directive) {
            /** @var \GraphQL\Language\AST\DirectiveNode $directive */
            $id = $directive->name->value;
            if (!$this->feedManager->hasDefinition($id)) {
              continue;
            }
            $config = [
              'typeName' => $definition->name->value,
            ];
            foreach ($directive->arguments->getIterator() as $arg) {
              /** @var \GraphQL\Language\AST\ArgumentNode $arg */
              $config[$arg->name->value] = $arg->value->value;
            }
            $this->feeds[] = $this->feedManager->createInstance($id, $config);
          }
        }
      }
    }
    return $this->feeds;
  }

  /**
   * {@inheritDoc}
   */
  public function getExtensionDefinition() {
    // Collect all active feeds and prepend their definitions to the schema.
    $schema = array_map(fn (FeedInterface $feed) => $feed->getSchemaDefinitions(), $this->getFeeds());
    array_unshift($schema, parent::getExtensionDefinition());
    return implode("\n", $schema);
  }

  /**
   * {@inheritDoc}
   */
  public function registerResolvers(ResolverRegistryInterface $registry) {
    $this->addFieldResolvers($registry, new ResolverBuilder());
  }

  /**
   * Implement field resolvers for this extension.
   */
  protected function addFieldResolvers(ResolverRegistry $registry, ResolverBuilder $builder) {

    $registry->addFieldResolver(
      'Query',
      'drupalFeedInfo',
      $builder->fromValue(array_map(fn (FeedInterface $feed) => $feed->info(), $this->getFeeds()))
    );
    $registry->addFieldResolver(
      'Query',
      'drupalBuildId',
      $builder->callback(function ($value, $args, ResolveContext $context) {
        // Make sure this is never cached.
        $context->mergeCacheMaxAge(0);
        /** @var \Drupal\silverback_gatsby\GatsbyUpdateTrackerInterface $tracker */
        $tracker = \Drupal::service('silverback_gatsby.update_tracker');
        return $tracker->latestBuild($context->getServer()->id());
      })
    );

    $registry->addFieldResolver('Feed', 'changes', $builder->callback(function ($value, $args, ResolveContext $context) {
      // Make sure this is never cached.
      $context->mergeCacheMaxAge(0);
      /** @var \Drupal\silverback_gatsby\GatsbyUpdateTrackerInterface $tracker */
      $tracker = \Drupal::service('silverback_gatsby.update_tracker');
      return array_map(fn ($change) => $change->id, array_filter(
        isset($args['lastBuild']) && isset($args['currentBuild'])
          ? $tracker->diff($args['lastBuild'], $args['currentBuild'], $context->getServer()->id())
          : [],
        fn ($change) => $change->type === $value['typeName']
      ));
    }));

    foreach($this->getFeeds() as $feed) {
      $registry->addFieldResolver('Query', $feed->getSingleFieldName(), $feed->resolveItem());
      $registry->addFieldResolver('Query', $feed->getListFieldName(), $feed->resolveItems());
      $typeName = $feed->isTranslatable() ? $feed->getTranslationsTypeName() : $feed->getTypeName();

      $registry->addFieldResolver($typeName, 'id', $feed->resolveId());
      if ($feed->isTranslatable()) {
        $registry->addFieldResolver($feed->getTypeName(), 'langcode', $feed->resolveLangcode());
        $registry->addFieldResolver($feed->getTranslationsTypeName(), 'translations', $feed->resolveTranslations());
      }
    }
  }

}